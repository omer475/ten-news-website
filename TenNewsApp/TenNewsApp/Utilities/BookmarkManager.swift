import Foundation

/// Manages saved/bookmarked articles using UserDefaults.
/// Stores article IDs and full article JSON for offline access.
@MainActor @Observable
final class BookmarkManager {
    static let shared = BookmarkManager()

    private(set) var savedArticleIDs: Set<String> = []
    private(set) var savedArticles: [Article] = []

    private var idsKey: String { "bookmarked_article_ids_\(currentUserId)" }
    private var articlesKey: String { "bookmarked_articles_data_\(currentUserId)" }
    private var currentUserId: String = "guest"

    private init() {
        load()
    }

    /// Switch to a different user's data
    func switchUser(_ userId: String?) {
        let newId = userId ?? "guest"
        guard newId != currentUserId else { return }
        // Migrate old non-prefixed data to this user's keys (one-time)
        if userId != nil {
            let oldIds = UserDefaults.standard.stringArray(forKey: "bookmarked_article_ids")
            let newKey = "bookmarked_article_ids_\(newId)"
            if oldIds != nil && !oldIds!.isEmpty && UserDefaults.standard.stringArray(forKey: newKey) == nil {
                UserDefaults.standard.set(oldIds, forKey: newKey)
                if let oldData = UserDefaults.standard.data(forKey: "bookmarked_articles_data") {
                    UserDefaults.standard.set(oldData, forKey: "bookmarked_articles_data_\(newId)")
                }
                UserDefaults.standard.removeObject(forKey: "bookmarked_article_ids")
                UserDefaults.standard.removeObject(forKey: "bookmarked_articles_data")
            }
        }
        currentUserId = newId
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

    /// Restore from server if local is empty
    func restoreFromServer(userId: String) {
        guard savedArticleIDs.isEmpty else { return }
        Task {
            do {
                let response: UserLikedResponse = try await APIClient.shared.get(
                    APIEndpoints.userLiked(userId: userId)
                )
                if !response.saved.isEmpty {
                    savedArticles = response.saved
                    savedArticleIDs = Set(response.saved_ids)
                    save()
                }
            } catch { }
        }
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
