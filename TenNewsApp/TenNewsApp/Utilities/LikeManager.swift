import Foundation

/// Manages liked articles using UserDefaults.
/// Stores article IDs and full article JSON for display in Liked Articles.
@MainActor @Observable
final class LikeManager {
    static let shared = LikeManager()

    private(set) var likedArticleIDs: Set<String> = []
    private(set) var likedArticles: [Article] = []

    private var idsKey: String { "liked_article_ids_\(currentUserId)" }
    private var articlesKey: String { "liked_articles_data_\(currentUserId)" }
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
            let oldIds = UserDefaults.standard.stringArray(forKey: "liked_article_ids")
            let newKey = "liked_article_ids_\(newId)"
            if oldIds != nil && !oldIds!.isEmpty && UserDefaults.standard.stringArray(forKey: newKey) == nil {
                UserDefaults.standard.set(oldIds, forKey: newKey)
                if let oldData = UserDefaults.standard.data(forKey: "liked_articles_data") {
                    UserDefaults.standard.set(oldData, forKey: "liked_articles_data_\(newId)")
                }
                // Clear old keys after migration
                UserDefaults.standard.removeObject(forKey: "liked_article_ids")
                UserDefaults.standard.removeObject(forKey: "liked_articles_data")
            }
        }
        currentUserId = newId
        load()
    }

    func isLiked(_ articleId: FlexibleID) -> Bool {
        likedArticleIDs.contains(articleId.stringValue)
    }

    func toggle(_ article: Article) {
        let id = article.id.stringValue
        let isLiking = !likedArticleIDs.contains(id)
        if isLiking {
            likedArticleIDs.insert(id)
            likedArticles.insert(article, at: 0)
        } else {
            likedArticleIDs.remove(id)
            likedArticles.removeAll { $0.id.stringValue == id }
        }
        save()

        if isLiking, let numericId = Int(id) {
            Task {
                try? await AnalyticsService().track(
                    event: "article_liked",
                    articleId: numericId,
                    category: article.category
                )
            }
        }
    }

    func like(_ article: Article) {
        guard !isLiked(article.id) else { return }
        toggle(article)
    }

    func clearAll() {
        likedArticleIDs.removeAll()
        likedArticles.removeAll()
        save()
    }

    /// Restore from server if local is empty
    func restoreFromServer(userId: String) {
        guard likedArticleIDs.isEmpty else { return }
        Task {
            do {
                let response: UserLikedResponse = try await APIClient.shared.get(
                    APIEndpoints.userLiked(userId: userId)
                )
                if !response.liked.isEmpty {
                    likedArticles = response.liked
                    likedArticleIDs = Set(response.liked_ids)
                    save()
                }
            } catch { }
        }
    }

    // MARK: - Persistence

    private func load() {
        likedArticleIDs = Set(UserDefaults.standard.stringArray(forKey: idsKey) ?? [])
        if let data = UserDefaults.standard.data(forKey: articlesKey),
           let articles = try? JSONDecoder().decode([Article].self, from: data) {
            likedArticles = articles
        }
    }

    private func save() {
        UserDefaults.standard.set(Array(likedArticleIDs), forKey: idsKey)
        if let data = try? JSONEncoder().encode(likedArticles) {
            UserDefaults.standard.set(data, forKey: articlesKey)
        }
    }
}
