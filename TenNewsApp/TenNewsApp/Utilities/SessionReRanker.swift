import Foundation

/// Real-time client-side feed re-ranker.
/// Tracks dwell time per article as the user swipes.
/// Fast swipe (<3s) = skip signal. Engaged (>=5s) = interest signal.
/// Re-ranks unseen articles instantly using tag/category overlap with session signals.
@MainActor @Observable
final class SessionReRanker {
    private(set) var engagedIds: Set<String> = []
    private(set) var skippedIds: Set<String> = []
    private(set) var sourceClickedIds: Set<String> = []

    // Tag frequency profiles built from session signals
    private var interestProfile: [String: Double] = [:]
    private var skipProfile: [String: Double] = [:]

    private let skipThreshold: TimeInterval = 3.0
    private let engageThreshold: TimeInterval = 5.0

    // MARK: - Record Signal

    func recordSignal(article: Article, dwellSeconds: TimeInterval) {
        let tags = articleTags(article)

        if dwellSeconds < skipThreshold {
            skippedIds.insert(article.id.stringValue)
            for tag in tags {
                skipProfile[tag] = (skipProfile[tag] ?? 0) + 1.0
            }
            if let cat = article.category?.lowercased() {
                skipProfile[cat] = (skipProfile[cat] ?? 0) + 0.5
            }
        } else if dwellSeconds >= engageThreshold {
            engagedIds.insert(article.id.stringValue)
            for tag in tags {
                interestProfile[tag] = (interestProfile[tag] ?? 0) + 1.0
            }
            if let cat = article.category?.lowercased() {
                interestProfile[cat] = (interestProfile[cat] ?? 0) + 0.5
            }
        }
        // 2-5s = neutral, no signal
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

    var sessionSignals: (engaged: [String], skipped: [String]) {
        (Array(engagedIds.prefix(50)), Array(skippedIds.prefix(50)))
    }

    func reset() {
        engagedIds.removeAll()
        skippedIds.removeAll()
        sourceClickedIds.removeAll()
        interestProfile.removeAll()
        skipProfile.removeAll()
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
