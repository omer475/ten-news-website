import Foundation

/// Real-time client-side feed re-ranker.
/// Tracks dwell time per article as the user swipes.
/// 4-tier dwell signals: hard skip (<1.5s), soft skip (1.5-3s), neutral (3-5s), engaged (>=5s).
/// Re-ranks unseen articles instantly using tag/category overlap with session signals.
///
/// v5.1 Phase 1 fix #8 (2026-05-06): now persists state across app launches
/// via UserDefaults with a 24h sliding TTL. Without this, the ReRanker
/// reset on every launch and a heavy user opening the app 5× a day got
/// 5 cold-context sessions, losing every signal between fetches.
/// Monolith-lite: persists user state as the platform recommender does.
@MainActor @Observable
final class SessionReRanker {
    private(set) var engagedIds: Set<String> = []
    private(set) var glancedIds: Set<String> = []
    private(set) var skippedIds: Set<String> = []
    private(set) var sourceClickedIds: Set<String> = []

    // Phase F (feed v11): dwell time captured for each skipped article so the
    // server can build a session taste-delta vector with Kuaishou-tier
    // negative weighting (read-then-skip is a much stronger negative than a
    // fast scroll-past). Capped at 50 most recent skips to keep the URL
    // payload bounded.
    private(set) var skipDwellMap: [String: TimeInterval] = [:]

    // Tag frequency profiles built from session signals
    private var interestProfile: [String: Double] = [:]
    private var skipProfile: [String: Double] = [:]

    private let hardSkipThreshold: TimeInterval = 1.5
    private let softSkipThreshold: TimeInterval = 3.0
    private let engageThreshold: TimeInterval = 5.0

    // MARK: - Persistence (Fix #8)

    private static let storageKey = "session_signals_v1"
    private static let ttlSeconds: TimeInterval = 24 * 60 * 60   // 24h sliding window
    private static let perSetCap = 200                            // bound storage growth
    private static let saveDebounceMs: UInt64 = 300

    /// Encoded snapshot for UserDefaults round-trip.
    private struct Snapshot: Codable {
        let engagedIds: [String]
        let glancedIds: [String]
        let skippedIds: [String]
        let sourceClickedIds: [String]
        let skipDwellMap: [String: TimeInterval]
        let interestProfile: [String: Double]
        let skipProfile: [String: Double]
        let savedAt: Date
    }

    private var saveTask: Task<Void, Never>?

    init() {
        loadFromDisk()
    }

    private func loadFromDisk() {
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey),
              let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data) else {
            return
        }
        let age = Date().timeIntervalSince(snapshot.savedAt)
        if age < 0 || age > Self.ttlSeconds {
            // Clock skew or expired — start clean.
            UserDefaults.standard.removeObject(forKey: Self.storageKey)
            return
        }
        engagedIds = Set(snapshot.engagedIds)
        glancedIds = Set(snapshot.glancedIds)
        skippedIds = Set(snapshot.skippedIds)
        sourceClickedIds = Set(snapshot.sourceClickedIds)
        skipDwellMap = snapshot.skipDwellMap
        interestProfile = snapshot.interestProfile
        skipProfile = snapshot.skipProfile
    }

    /// Debounced write — coalesces bursty mutations during fast scrolling.
    /// Saves an absolute capped snapshot so storage never grows unbounded.
    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: Self.saveDebounceMs * 1_000_000)
            guard !Task.isCancelled else { return }
            self?.persistNow()
        }
    }

    private func persistNow() {
        let cap = Self.perSetCap
        let snapshot = Snapshot(
            engagedIds: Array(engagedIds.prefix(cap)),
            glancedIds: Array(glancedIds.prefix(cap)),
            skippedIds: Array(skippedIds.prefix(cap)),
            sourceClickedIds: Array(sourceClickedIds.prefix(cap)),
            skipDwellMap: skipDwellMap,
            interestProfile: interestProfile,
            skipProfile: skipProfile,
            savedAt: Date()
        )
        if let data = try? JSONEncoder().encode(snapshot) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
    }

    // MARK: - Record Signal

    func recordSignal(article: Article, dwellSeconds: TimeInterval) {
        let tags = articleTags(article)

        if dwellSeconds < hardSkipThreshold {
            // Hard skip: didn't even read headline — strong negative
            skippedIds.insert(article.id.stringValue)
            skipDwellMap[article.id.stringValue] = dwellSeconds
            for tag in tags {
                skipProfile[tag] = (skipProfile[tag] ?? 0) + 1.0
            }
            if let cat = article.category?.lowercased() {
                skipProfile[cat] = (skipProfile[cat] ?? 0) + 0.5
            }
        } else if dwellSeconds < softSkipThreshold {
            // Soft skip: read headline but wasn't interested — moderate negative
            skippedIds.insert(article.id.stringValue)
            skipDwellMap[article.id.stringValue] = dwellSeconds
            for tag in tags {
                skipProfile[tag] = (skipProfile[tag] ?? 0) + 0.4
            }
            if let cat = article.category?.lowercased() {
                skipProfile[cat] = (skipProfile[cat] ?? 0) + 0.2
            }
        } else if dwellSeconds >= engageThreshold {
            // Engaged: spent meaningful time — positive signal
            engagedIds.insert(article.id.stringValue)
            for tag in tags {
                interestProfile[tag] = (interestProfile[tag] ?? 0) + 1.0
            }
            if let cat = article.category?.lowercased() {
                interestProfile[cat] = (interestProfile[cat] ?? 0) + 0.5
            }
        } else {
            // 3-5s = glance — weak positive signal (0.3 weight)
            glancedIds.insert(article.id.stringValue)
            for tag in tags {
                interestProfile[tag] = (interestProfile[tag] ?? 0) + 0.3
            }
            if let cat = article.category?.lowercased() {
                interestProfile[cat] = (interestProfile[cat] ?? 0) + 0.15
            }
        }
        scheduleSave()
    }

    /// Scroll-back = very strong positive signal (4x weight).
    /// User saw the next article, decided this one was more interesting, went back.
    func recordRevisit(article: Article) {
        engagedIds.insert(article.id.stringValue)
        let tags = articleTags(article)
        for tag in tags {
            interestProfile[tag] = (interestProfile[tag] ?? 0) + 4.0
        }
        if let cat = article.category?.lowercased() {
            interestProfile[cat] = (interestProfile[cat] ?? 0) + 2.0
        }
        scheduleSave()
    }

    /// Source click = strongest engagement signal (3× weight)
    func recordSourceClick(article: Article) {
        sourceClickedIds.insert(article.id.stringValue)
        engagedIds.insert(article.id.stringValue)
        let tags = articleTags(article)
        for tag in tags {
            interestProfile[tag] = (interestProfile[tag] ?? 0) + 3.0
        }
        if let cat = article.category?.lowercased() {
            interestProfile[cat] = (interestProfile[cat] ?? 0) + 1.5
        }
        scheduleSave()
    }

    // MARK: - Re-rank

    /// Re-ranks articles. Items at 0...currentIndex stay fixed (already seen).
    /// Items after currentIndex are re-ranked based on session signals.
    func rerank(articles: [Article], currentIndex: Int) -> [Article] {
        guard !interestProfile.isEmpty || !skipProfile.isEmpty else { return articles }
        let splitAt = min(currentIndex + 1, articles.count)
        guard splitAt < articles.count else { return articles }

        let seen = Array(articles[0..<splitAt])
        let unseen = Array(articles[splitAt...])

        // Score each unseen article
        var scores: [String: Double] = [:]
        let totalUnseen = Double(unseen.count)

        for (i, article) in unseen.enumerated() {
            let tags = articleTags(article)
            let cat = article.category?.lowercased()

            var boost: Double = 0
            for tag in tags { boost += interestProfile[tag] ?? 0 }
            if let cat { boost += (interestProfile[cat] ?? 0) * 0.5 }

            var penalty: Double = 0
            for tag in tags { penalty += skipProfile[tag] ?? 0 }
            if let cat { penalty += (skipProfile[cat] ?? 0) * 0.5 }

            let tagCount = max(Double(tags.count), 1.0)
            let sessionScore = (boost - penalty) / tagCount

            // Original server rank normalized (0 = best, 1 = worst)
            let serverRank = Double(i) / max(totalUnseen - 1, 1)

            // Blend: 80% server (V2 handles MMR diversity + slot patterns), 20% session
            let clamped = max(-2.0, min(2.0, sessionScore))
            scores[article.id.stringValue] = (1.0 - serverRank) * 0.8 + clamped * 0.2
        }

        let sorted = unseen.sorted {
            (scores[$0.id.stringValue] ?? 0) > (scores[$1.id.stringValue] ?? 0)
        }
        return seen + sorted
    }

    // MARK: - Session Context for Server

    var sessionSignals: (engaged: [String], glanced: [String], skipped: [String]) {
        (Array(engagedIds.prefix(50)), Array(glancedIds.prefix(50)), Array(skippedIds.prefix(50)))
    }

    /// Phase F (feed v11): JSON-serialised dwell map for the 50 most recent
    /// skips, fed to the server's session taste-delta vector for Kuaishou-tier
    /// negative weighting. Returns "" when there are no skips so the caller
    /// can simply check isEmpty before adding a query parameter.
    var sessionSkipDwellsJSON: String {
        let recent = Array(skippedIds.prefix(50))
        var trimmed: [String: Double] = [:]
        for id in recent {
            if let d = skipDwellMap[id] {
                trimmed[id] = (d * 10).rounded() / 10  // 1 decimal place
            }
        }
        guard !trimmed.isEmpty,
              let data = try? JSONSerialization.data(withJSONObject: trimmed, options: []),
              let str = String(data: data, encoding: .utf8) else {
            return ""
        }
        return str
    }

    /// Hard reset — wipes in-memory state AND the persisted snapshot.
    /// Reserved for explicit "fresh feed" intents (manual pull-to-refresh).
    /// App-launch flow no longer calls this; persistent state survives the
    /// 24h TTL (see init / loadFromDisk).
    func reset() {
        engagedIds.removeAll()
        glancedIds.removeAll()
        skippedIds.removeAll()
        sourceClickedIds.removeAll()
        skipDwellMap.removeAll()
        interestProfile.removeAll()
        skipProfile.removeAll()
        saveTask?.cancel()
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
    }

    // MARK: - Helpers

    private func articleTags(_ article: Article) -> [String] {
        if let t = article.interestTags, !t.isEmpty {
            return t.map { $0.lowercased() }
        }
        if let t = article.topics, !t.isEmpty {
            return t.map { $0.lowercased() }
        }
        return []
    }
}
