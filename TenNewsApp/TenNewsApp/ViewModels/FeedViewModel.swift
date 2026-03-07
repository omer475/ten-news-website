import SwiftUI

@MainActor @Observable
final class FeedViewModel {
    var allArticles: [Article] = []
    var worldEvents: [WorldEvent] = []
    var currentIndex: Int = 0
    var isLoading = false
    var errorMessage: String?
    var hasMore = true
    let reRanker = SessionReRanker()

    private var nextCursor: String? = nil
    private var currentPreferences: UserPreferences?
    private var currentUserId: String?
    private var viewStartTimes: [String: Date] = [:]

    private let feedService = FeedService()
    private let eventService = WorldEventService()
    private let analytics = AnalyticsService()

    /// Articles in re-ranked order. Items already swiped past keep their position.
    /// Unseen items are re-ranked in real-time by session signals.
    var articles: [Article] {
        let followedSlugs = Set(UserDefaults.standard.stringArray(forKey: "followed_event_slugs") ?? [])
        let filtered: [Article]
        if followedSlugs.isEmpty {
            filtered = allArticles
        } else {
            filtered = allArticles.filter { article in
                guard let slug = article.worldEvent?.slug else { return true }
                return !followedSlugs.contains(slug)
            }
        }
        return reRanker.rerank(articles: filtered, currentIndex: currentIndex)
    }

    // MARK: - Data Loading

    func loadInitialData(preferences: UserPreferences? = nil, userId: String? = nil) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        currentPreferences = preferences
        currentUserId = userId
        reRanker.reset()
        do {
            let feedResponse = try await feedService.fetchMainFeed(
                limit: 10,
                preferences: preferences,
                userId: userId
            )
            allArticles = feedResponse.articles
            nextCursor = feedResponse.nextCursor
            hasMore = feedResponse.hasMore
            isLoading = false

            Task {
                if let eventsResponse = try? await eventService.fetchWorldEvents() {
                    worldEvents = eventsResponse.events
                }
            }
        } catch {
            print("FeedViewModel loadInitialData error: \(error)")
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func loadMoreIfNeeded() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        do {
            let signals = reRanker.sessionSignals
            let existingIds = allArticles.map { $0.id.stringValue }
            let response = try await feedService.fetchMainFeed(
                cursor: nextCursor,
                limit: 10,
                preferences: currentPreferences,
                userId: currentUserId,
                engagedIds: signals.engaged,
                skippedIds: signals.skipped,
                seenIds: existingIds
            )
            let existingSet = Set(existingIds)
            let newArticles = response.articles.filter { !existingSet.contains($0.id.stringValue) }
            allArticles.append(contentsOf: newArticles)
            nextCursor = response.nextCursor
            hasMore = response.hasMore
            isLoading = false
        } catch {
            isLoading = false
        }
    }

    // MARK: - Swipe Signal Tracking

    /// Call when a new card appears (user swiped to it)
    func recordViewStart(at index: Int) {
        let arts = articles
        guard index < arts.count else { return }
        viewStartTimes[arts[index].id.stringValue] = Date()
    }

    /// Call when user leaves a card (swiped away). Computes dwell time,
    /// feeds to re-ranker, and sends the appropriate analytics event:
    ///  - <3s dwell → article_skipped (pushes taste vector AWAY)
    ///  - 3-5s dwell → article_view (neutral, no taste vector update)
    ///  - >=5s dwell → article_engaged (pulls taste vector toward content)
    func recordSwipeAway(fromIndex: Int) {
        let arts = articles
        guard fromIndex < arts.count else { return }
        let article = arts[fromIndex]
        let dwellSeconds: TimeInterval
        if let start = viewStartTimes[article.id.stringValue] {
            dwellSeconds = Date().timeIntervalSince(start)
        } else {
            dwellSeconds = 0
        }
        viewStartTimes.removeValue(forKey: article.id.stringValue)
        reRanker.recordSignal(article: article, dwellSeconds: dwellSeconds)

        // Send dwell-based event to server
        let event: String
        if dwellSeconds < 3.0 {
            event = "article_skipped"
        } else if dwellSeconds >= 5.0 {
            event = "article_engaged"
        } else {
            event = "article_view"
        }
        Task {
            try? await analytics.track(
                event: event,
                articleId: Int(article.id.stringValue),
                metadata: ["dwell": String(format: "%.1f", dwellSeconds)]
            )
        }
    }

    func trackArticleView(at index: Int) {
        let arts = articles
        guard index < arts.count else { return }
        let article = arts[index]
        ReadingHistoryManager.shared.recordView(of: article)
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
