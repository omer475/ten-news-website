import Foundation

/// Tracks articles the user has viewed, stored in UserDefaults for local display.
/// Personalization scoring is handled server-side via embedding-based taste vectors.
@MainActor @Observable
final class ReadingHistoryManager {
    static let shared = ReadingHistoryManager()

    private(set) var entries: [HistoryEntry] = []

    /// Count of articles read for more than 3 seconds
    private(set) var readCount: Int = 0

    /// Active user id used to namespace persistence so reading history for
    /// the previous user can never appear under a different account. nil = guest.
    private var activeUserId: String?

    // Legacy un-namespaced keys (pre-2026-05-13). Migrated to the first real
    // user that signs in after the namespacing upgrade.
    private static let legacyStorageKey = "reading_history_entries"
    private static let legacyReadCountKey = "articles_read_count"
    private static let legacyReadArticleIdsKey = "articles_read_ids"

    private var storageKey: String {
        (activeUserId?.isEmpty == false) ? "reading_history_entries_\(activeUserId!)" : "reading_history_entries_guest"
    }
    private var readCountKey: String {
        (activeUserId?.isEmpty == false) ? "articles_read_count_\(activeUserId!)" : "articles_read_count_guest"
    }
    private var readArticleIdsKey: String {
        (activeUserId?.isEmpty == false) ? "articles_read_ids_\(activeUserId!)" : "articles_read_ids_guest"
    }
    private let maxEntries = 500

    /// Set of article IDs that have been counted as "read" (>3s dwell)
    private var readArticleIds: Set<String> = []

    private init() {
        SessionManager.shared.register(self)
        // Don't load anything yet — wait for loadForActiveUser. Guest data
        // becomes accessible once the active user is set to nil explicitly.
    }

    private func reloadFromDefaults() {
        load()
        readCount = UserDefaults.standard.integer(forKey: readCountKey)
        if let ids = UserDefaults.standard.array(forKey: readArticleIdsKey) as? [String] {
            readArticleIds = Set(ids)
        } else {
            readArticleIds = []
        }
    }

    /// Move legacy un-namespaced keys to the first real user's slot the first
    /// time they sign in. Same migration pattern as FollowManager.
    private func migrateLegacyIfNeeded() {
        guard activeUserId?.isEmpty == false else { return }
        let namespacedHas = UserDefaults.standard.data(forKey: storageKey) != nil
            || UserDefaults.standard.integer(forKey: readCountKey) > 0
        guard !namespacedHas else { return }
        let legacyData = UserDefaults.standard.data(forKey: Self.legacyStorageKey)
        let legacyCount = UserDefaults.standard.integer(forKey: Self.legacyReadCountKey)
        let legacyIds = UserDefaults.standard.array(forKey: Self.legacyReadArticleIdsKey) as? [String]
        guard legacyData != nil || legacyCount > 0 || (legacyIds?.isEmpty == false) else { return }
        if let legacyData {
            UserDefaults.standard.set(legacyData, forKey: storageKey)
        }
        if legacyCount > 0 {
            UserDefaults.standard.set(legacyCount, forKey: readCountKey)
        }
        if let legacyIds {
            UserDefaults.standard.set(legacyIds, forKey: readArticleIdsKey)
        }
        UserDefaults.standard.removeObject(forKey: Self.legacyStorageKey)
        UserDefaults.standard.removeObject(forKey: Self.legacyReadCountKey)
        UserDefaults.standard.removeObject(forKey: Self.legacyReadArticleIdsKey)
    }

    struct HistoryEntry: Codable, Identifiable {
        let articleId: String
        let title: String
        let source: String?
        let category: String?
        let topics: [String]?
        let countries: [String]?
        let imageUrl: String?
        let viewedAt: Date

        var id: String { "\(articleId)-\(viewedAt.timeIntervalSince1970)" }
    }

    /// Record that an article was viewed. Deduplicates recent views of the same article.
    func recordView(of article: Article) {
        let id = article.id.stringValue

        // Don't re-record if viewed in the last 5 minutes
        if let last = entries.first(where: { $0.articleId == id }),
           Date().timeIntervalSince(last.viewedAt) < 300 {
            return
        }

        let entry = HistoryEntry(
            articleId: id,
            title: article.displayTitle,
            source: article.source,
            category: article.category,
            topics: article.topics,
            countries: article.countries,
            imageUrl: article.imageUrl ?? article.urlToImage,
            viewedAt: Date()
        )

        entries.insert(entry, at: 0)

        // Count every viewed article (only once per article)
        if !readArticleIds.contains(id) {
            readArticleIds.insert(id)
            readCount += 1
            UserDefaults.standard.set(readCount, forKey: readCountKey)
            UserDefaults.standard.set(Array(readArticleIds), forKey: readArticleIdsKey)
        }

        // Trim to max
        if entries.count > maxEntries {
            entries = Array(entries.prefix(maxEntries))
        }

        save()
    }

    /// Record that an article was actually read (dwell > 3 seconds). Only counts each article once.
    func recordRead(articleId: String) {
        guard !readArticleIds.contains(articleId) else { return }
        readArticleIds.insert(articleId)
        readCount += 1
        UserDefaults.standard.set(readCount, forKey: readCountKey)
        UserDefaults.standard.set(Array(readArticleIds), forKey: readArticleIdsKey)
    }

    /// Returns all article IDs the user has ever seen (persisted across restarts).
    /// Used for dedup — send to server to prevent duplicate articles in feed.
    func seenArticleIds(limit: Int = 500) -> [String] {
        return Array(readArticleIds.prefix(limit))
    }

    /// Sync read count from server if local is lower (e.g. after account switch or data loss)
    func syncReadCount(serverCount: Int) {
        if serverCount > readCount {
            readCount = serverCount
            UserDefaults.standard.set(readCount, forKey: readCountKey)
        }
    }

    func clearHistory() {
        entries.removeAll()
        readCount = 0
        readArticleIds.removeAll()
        save()
        UserDefaults.standard.set(0, forKey: readCountKey)
        UserDefaults.standard.set([String](), forKey: readArticleIdsKey)
    }

    // MARK: - Persistence

    private func load() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode([HistoryEntry].self, from: data) {
            entries = decoded
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }
}

// MARK: - UserScopedStore conformance

extension ReadingHistoryManager: UserScopedStore {
    func resetForUserSwitch() {
        entries.removeAll()
        readCount = 0
        readArticleIds.removeAll()
        activeUserId = nil
    }
    func loadForActiveUser(_ userId: String?) {
        activeUserId = userId
        migrateLegacyIfNeeded()
        reloadFromDefaults()
    }
}
