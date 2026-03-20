import Foundation

/// Manages liked articles using UserDefaults.
/// Stores article IDs and full article JSON for display in Liked Articles.
@MainActor @Observable
final class LikeManager {
    static let shared = LikeManager()

    private(set) var likedArticleIDs: Set<String> = []
    private(set) var likedArticles: [Article] = []

    private let idsKey = "liked_article_ids"
    private let articlesKey = "liked_articles_data"

    private init() {
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
