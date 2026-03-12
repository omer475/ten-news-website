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

    /// Stable article list — only rebuilt after data loads, NOT during swipe signals.
    /// This prevents the re-ranker from reordering articles mid-swipe.
    private(set) var articles: [Article] = []

    private var nextCursor: String? = nil
    private var currentPreferences: UserPreferences?
    private var currentUserId: String?
    private var viewStartTimes: [String: Date] = [:]

    private let feedService = FeedService()
    private let eventService = WorldEventService()
    private let analytics = AnalyticsService()

    /// Returns true if the article passes feed filters.
    /// V2 handles recency via time-decay scoring, so no client-side age filter needed.
    private func passesFeedFilters(_ article: Article, followedSlugs: Set<String>) -> Bool {
        if let slug = article.worldEvent?.slug, followedSlugs.contains(slug) { return false }
        return true
    }

    /// Rebuild the article list from allArticles with filtering and re-ranking.
    /// Call after initial data load and refresh — NOT during loadMore or swipe signals.
    func rebuildArticleList() {
        let followedSlugs = Set(UserDefaults.standard.stringArray(forKey: "followed_event_slugs") ?? [])
        let filtered = allArticles.filter { passesFeedFilters($0, followedSlugs: followedSlugs) }
        articles = reRanker.rerank(articles: filtered, currentIndex: currentIndex)
    }

    private let fetchLimit = 25

    // MARK: - Data Loading

    func loadInitialData(preferences: UserPreferences? = nil, userId: String? = nil) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        currentPreferences = preferences
        currentUserId = userId
        reRanker.reset()
        do {
            // Send local reading history so server excludes already-seen articles
            let historyIds = ReadingHistoryManager.shared.entries
                .prefix(300)
                .map { $0.articleId }
            let feedResponse = try await feedService.fetchMainFeed(
                limit: fetchLimit,
                preferences: preferences,
                userId: userId,
                seenIds: Array(historyIds)
            )
            allArticles = feedResponse.articles
            nextCursor = feedResponse.nextCursor
            hasMore = feedResponse.hasMore
            rebuildArticleList()
            isLoading = false

            // If filters removed everything but server has more, keep fetching
            if articles.isEmpty && hasMore {
                await loadMoreUntilVisible()
            }

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
        await loadMoreBatch()
    }

    /// Fetch one batch, filter, append visible articles, and re-rank the new batch.
    /// Returns the count of articles that passed filters.
    @discardableResult
    private func loadMoreBatch() async -> Int {
        isLoading = true
        do {
            let signals = reRanker.sessionSignals
            let existingIds = allArticles.map { $0.id.stringValue }
            let response = try await feedService.fetchMainFeed(
                cursor: nextCursor,
                limit: fetchLimit,
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

            // Filter and re-rank new batch among themselves (don't reorder existing articles)
            let followedSlugs = Set(UserDefaults.standard.stringArray(forKey: "followed_event_slugs") ?? [])
            let filtered = newArticles.filter { passesFeedFilters($0, followedSlugs: followedSlugs) }
            let ranked = reRanker.rerank(articles: filtered, currentIndex: -1)
            articles.append(contentsOf: ranked)
            isLoading = false
            return filtered.count
        } catch {
            isLoading = false
            return 0
        }
    }

    /// Keep fetching batches until we have visible articles or the server says no more.
    private func loadMoreUntilVisible() async {
        var retries = 0
        while hasMore && retries < 3 {
            let added = await loadMoreBatch()
            if added > 0 { break }
            retries += 1
        }
    }

    /// Pull-to-refresh: reload from scratch while preserving preferences
    func refresh() async {
        nextCursor = nil
        hasMore = true
        reRanker.reset()
        viewStartTimes.removeAll()
        isLoading = true
        errorMessage = nil
        do {
            let historyIds = ReadingHistoryManager.shared.entries
                .prefix(300)
                .map { $0.articleId }
            let feedResponse = try await feedService.fetchMainFeed(
                limit: fetchLimit,
                preferences: currentPreferences,
                userId: currentUserId,
                seenIds: Array(historyIds)
            )
            allArticles = feedResponse.articles
            nextCursor = feedResponse.nextCursor
            hasMore = feedResponse.hasMore
            rebuildArticleList()
            isLoading = false

            if articles.isEmpty && hasMore {
                await loadMoreUntilVisible()
            }
        } catch {
            errorMessage = error.localizedDescription
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

        // Send dwell-based event to server (V2 uses dwell time for interest profile weighting)
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
                category: article.category,
                metadata: [
                    "dwell": String(format: "%.1f", dwellSeconds),
                    "total_active_seconds": String(format: "%.1f", dwellSeconds),
                    "bucket": article.bucket ?? "unknown"
                ]
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
