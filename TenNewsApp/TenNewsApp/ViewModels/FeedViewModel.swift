import SwiftUI

@MainActor @Observable
final class FeedViewModel {
    var allArticles: [Article] = []
    var worldEvents: [WorldEvent] = []
    var currentIndex: Int = 0
    var isLoading = false
    var errorMessage: String?
    var hasMore = true
    private var nextCursor: String? = nil
    private var currentPreferences: UserPreferences?
    private var currentUserId: String?

    private let feedService = FeedService()
    private let eventService = WorldEventService()
    private let analytics = AnalyticsService()

    /// Articles in server-provided order (embedding-scored or tag-scored),
    /// filtered to exclude those belonging to followed events.
    /// Server handles all personalization via taste vector embeddings.
    func articles(for preferences: UserPreferences = .empty) -> [Article] {
        let followedSlugs = Set(UserDefaults.standard.stringArray(forKey: "followed_event_slugs") ?? [])
        guard !followedSlugs.isEmpty else { return allArticles }
        return allArticles.filter { article in
            guard let slug = article.worldEvent?.slug else { return true }
            return !followedSlugs.contains(slug)
        }
    }

    /// Legacy accessor for views that don't pass preferences
    var articles: [Article] {
        let followedSlugs = Set(UserDefaults.standard.stringArray(forKey: "followed_event_slugs") ?? [])
        guard !followedSlugs.isEmpty else { return allArticles }
        return allArticles.filter { article in
            guard let slug = article.worldEvent?.slug else { return true }
            return !followedSlugs.contains(slug)
        }
    }

    func loadInitialData(preferences: UserPreferences? = nil, userId: String? = nil) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        currentPreferences = preferences
        currentUserId = userId
        do {
            let feedResponse = try await feedService.fetchMainFeed(
                preferences: preferences,
                userId: userId
            )
            allArticles = feedResponse.articles
            nextCursor = feedResponse.nextCursor
            hasMore = feedResponse.hasMore
            isLoading = false

            // Load world events in background — don't block the feed
            Task {
                if let eventsResponse = try? await eventService.fetchWorldEvents() {
                    worldEvents = eventsResponse.events
                }
            }
        } catch {
            print("❌ FeedViewModel loadInitialData error: \(error)")
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func loadMoreIfNeeded() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        do {
            let response = try await feedService.fetchMainFeed(
                cursor: nextCursor,
                preferences: currentPreferences,
                userId: currentUserId
            )
            allArticles.append(contentsOf: response.articles)
            nextCursor = response.nextCursor
            hasMore = response.hasMore
            isLoading = false
        } catch {
            isLoading = false
        }
    }

    func trackArticleView(at index: Int) {
        guard index < articles.count else { return }
        let article = articles[index]
        ReadingHistoryManager.shared.recordView(of: article)
        Task {
            try? await analytics.track(
                event: "article_view",
                articleId: Int(article.id.stringValue),
                metadata: ["index": String(index)]
            )
        }
    }

    /// Color for article based on category
    func accentColor(for article: Article) -> Color {
        let categoryColors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
            "Climate": "#339966", "Economy": "#228866"
        ]
        let hex = categoryColors[article.category ?? ""] ?? "#3366CC"
        return Color(hex: hex)
    }

}
