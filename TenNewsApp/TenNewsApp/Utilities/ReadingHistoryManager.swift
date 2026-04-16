import Foundation

/// Tracks articles the user has viewed, stored in UserDefaults for local display.
/// Personalization scoring is handled server-side via embedding-based taste vectors.
@MainActor @Observable
final class ReadingHistoryManager {
    static let shared = ReadingHistoryManager()

    private(set) var entries: [HistoryEntry] = []

    /// Count of articles read for more than 3 seconds
    private(set) var readCount: Int = 0

    private let storageKey = "reading_history_entries"
    private let readCountKey = "articles_read_count"
    private let readArticleIdsKey = "articles_read_ids"
    private let maxEntries = 500

    /// Set of article IDs that have been counted as "read" (>3s dwell)
    private var readArticleIds: Set<String> = []

    private init() {
        load()
        readCount = UserDefaults.standard.integer(forKey: readCountKey)
        if let ids = UserDefaults.standard.array(forKey: readArticleIdsKey) as? [String] {
            readArticleIds = Set(ids)
        }
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
