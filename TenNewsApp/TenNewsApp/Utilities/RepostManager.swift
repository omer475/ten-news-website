import Foundation

/// Tracks which articles the user has reposted (X/Threads-style "share to my
/// followers without commentary"). Slimmer than LikeManager: only stores ids
/// + the full article payload for a future "Reposted" tab on the profile.
/// Per-user persistence via UserDefaults, same prefixing pattern as
/// LikeManager / BookmarkManager.
///
/// Algorithm relevance: each toggle fires `article_reposted` / `article_unreposted`
/// so the ranker has a stronger positive signal than a plain "like" but
/// distinct from a 1-on-1 share. The algorithm team weights reposts roughly
/// between like (+0.5) and share (+1.0).
@MainActor @Observable
final class RepostManager {
    static let shared = RepostManager()

    private(set) var repostedArticleIDs: Set<String> = []
    private(set) var repostedArticles: [Article] = []

    private var idsKey: String { "reposted_article_ids_\(currentUserId)" }
    private var articlesKey: String { "reposted_articles_data_\(currentUserId)" }
    private var currentUserId: String = "guest"

    private init() {
        load()
        SessionManager.shared.register(self)
    }

    /// Switch to a different user's data (called after login / logout).
    func switchUser(_ userId: String?) {
        let newId = userId ?? "guest"
        guard newId != currentUserId else { return }
        currentUserId = newId
        load()
    }

    func isReposted(_ articleId: FlexibleID) -> Bool {
        repostedArticleIDs.contains(articleId.stringValue)
    }

    func toggle(_ article: Article) {
        let id = article.id.stringValue
        let isReposting = !repostedArticleIDs.contains(id)
        if isReposting {
            repostedArticleIDs.insert(id)
            repostedArticles.insert(article, at: 0)
        } else {
            repostedArticleIDs.remove(id)
            repostedArticles.removeAll { $0.id.stringValue == id }
        }
        save()

        if let numericId = Int(id) {
            Task {
                try? await AnalyticsService().track(
                    event: isReposting ? "article_reposted" : "article_unreposted",
                    articleId: numericId,
                    category: article.category
                )
            }
        }
    }

    private func load() {
        let ids = UserDefaults.standard.stringArray(forKey: idsKey) ?? []
        repostedArticleIDs = Set(ids)
        if let data = UserDefaults.standard.data(forKey: articlesKey),
           let decoded = try? JSONDecoder().decode([Article].self, from: data) {
            repostedArticles = decoded
        } else {
            repostedArticles = []
        }
    }

    private func save() {
        UserDefaults.standard.set(Array(repostedArticleIDs), forKey: idsKey)
        if let data = try? JSONEncoder().encode(repostedArticles) {
            UserDefaults.standard.set(data, forKey: articlesKey)
        }
    }

    func clearAll() {
        repostedArticleIDs.removeAll()
        repostedArticles.removeAll()
        save()
    }
}

// MARK: - UserScopedStore conformance

extension RepostManager: UserScopedStore {
    func resetForUserSwitch() {
        repostedArticleIDs.removeAll()
        repostedArticles.removeAll()
    }
    func loadForActiveUser(_ userId: String?) {
        switchUser(userId)
    }
}
