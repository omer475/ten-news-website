import Foundation

/// Tracks articles the user has viewed, stored in UserDefaults for local display.
/// Personalization scoring is handled server-side via embedding-based taste vectors.
@MainActor @Observable
final class ReadingHistoryManager {
    static let shared = ReadingHistoryManager()

    private(set) var entries: [HistoryEntry] = []

    private let storageKey = "reading_history_entries"
    private let maxEntries = 500

    private init() {
        load()
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
            title: article.plainTitle,
            source: article.source,
            category: article.category,
            topics: article.topics,
            countries: article.countries,
            imageUrl: article.imageUrl ?? article.urlToImage,
            viewedAt: Date()
        )

        entries.insert(entry, at: 0)

        // Trim to max
        if entries.count > maxEntries {
            entries = Array(entries.prefix(maxEntries))
        }

        save()
    }

    func clearHistory() {
        entries.removeAll()
        save()
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
