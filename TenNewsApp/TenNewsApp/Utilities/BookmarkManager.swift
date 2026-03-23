import Foundation

/// Manages saved/bookmarked articles using UserDefaults.
/// Stores article IDs and full article JSON for offline access.
@MainActor @Observable
final class BookmarkManager {
    static let shared = BookmarkManager()

    private(set) var savedArticleIDs: Set<String> = []
    private(set) var savedArticles: [Article] = []

    private let idsKey = "bookmarked_article_ids"
    private let articlesKey = "bookmarked_articles_data"

    private init() {
        load()
    }

    func isBookmarked(_ articleId: FlexibleID) -> Bool {
        savedArticleIDs.contains(articleId.stringValue)
    }

    func toggle(_ article: Article) {
        let id = article.id.stringValue
        let isSaving = !savedArticleIDs.contains(id)
        if isSaving {
            savedArticleIDs.insert(id)
            savedArticles.insert(article, at: 0)
        } else {
            savedArticleIDs.remove(id)
            savedArticles.removeAll { $0.id.stringValue == id }
        }
        save()

        // Signal the backend on save (not unsave) for taste vector evolution
        if isSaving, let numericId = Int(id) {
            Task {
                try? await AnalyticsService().track(
                    event: "article_saved",
                    articleId: numericId,
                    category: article.category,
                    metadata: ["bucket": article.bucket ?? "personal"]
                )
            }
        }
    }

    func clearAll() {
        savedArticleIDs.removeAll()
        savedArticles.removeAll()
        save()
    }

    // MARK: - Persistence

    private func load() {
        savedArticleIDs = Set(UserDefaults.standard.stringArray(forKey: idsKey) ?? [])
        if let data = UserDefaults.standard.data(forKey: articlesKey),
           let articles = try? JSONDecoder().decode([Article].self, from: data) {
            savedArticles = articles
        }
    }

    private func save() {
        UserDefaults.standard.set(Array(savedArticleIDs), forKey: idsKey)
        if let data = try? JSONEncoder().encode(savedArticles) {
            UserDefaults.standard.set(data, forKey: articlesKey)
        }
    }
}
