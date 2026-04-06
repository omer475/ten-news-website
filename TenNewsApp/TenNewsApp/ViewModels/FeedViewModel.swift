import SwiftUI
import os

private let feedLog = Logger(subsystem: "com.tennews.app", category: "Feed")

@MainActor @Observable
final class FeedViewModel {
    var allArticles: [Article] = []
    var worldEvents: [WorldEvent] = []
    var currentIndex: Int = 0
    var isLoading = false
    var isRefreshing = false
    var errorMessage: String?
    var hasMore = true
    var feedState: String = "normal"
    var freshCount: Int = 0
    var caughtUpMessage: String?
    private var hasMoreBecameFalseAt: Date?
    let reRanker = SessionReRanker()

    /// Stable article list — only rebuilt after data loads, NOT during swipe signals.
    /// This prevents the re-ranker from reordering articles mid-swipe.
    private(set) var articles: [Article] = []

    private var nextCursor: String? = nil
    private(set) var currentPreferences: UserPreferences?
    private(set) var currentUserId: String?
    private var viewStartTimes: [String: Date] = [:]
    private(set) var lastRefreshTime: Date?

    private let feedService = FeedService()
    private let eventService = WorldEventService()
    private let analytics = AnalyticsService()

    /// Feed is stale if last refresh was more than 5 minutes ago (or never loaded).
    var isStale: Bool {
        guard let lastRefresh = lastRefreshTime else { return true }
        return Date().timeIntervalSince(lastRefresh) > 300
    }

    /// Returns true if the article passes feed filters.
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
        guard !isLoading, !isRefreshing else { return }
        isLoading = true
        errorMessage = nil
        currentPreferences = preferences
        currentUserId = userId
        reRanker.reset()
        do {
            // Fix 6: Send persisted reading history for dedup on first page.
            // ReadingHistoryManager persists seen article IDs across app restarts.
            let persistedSeenIds = ReadingHistoryManager.shared.seenArticleIds(limit: 500)
            let feedResponse = try await feedService.fetchMainFeed(
                limit: fetchLimit,
                preferences: preferences,
                userId: userId,
                seenIds: persistedSeenIds
            )
            allArticles = feedResponse.articles
            nextCursor = feedResponse.nextCursor
            hasMore = feedResponse.hasMore
            hasMoreBecameFalseAt = feedResponse.hasMore ? nil : Date()
            feedState = feedResponse.feedState ?? "normal"
            freshCount = feedResponse.freshCount ?? feedResponse.articles.count
            caughtUpMessage = feedResponse.caughtUpMessage
            rebuildArticleList()
            isLoading = false
            lastRefreshTime = Date()

            feedLog.warning("loadInitialData: \(feedResponse.articles.count) articles, hasMore=\(feedResponse.hasMore), feedState=\(self.feedState, privacy: .public), freshCount=\(self.freshCount), total=\(feedResponse.total ?? -1), cursor=\(feedResponse.nextCursor ?? "nil", privacy: .public), userId=\(userId ?? "nil", privacy: .public)")

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
            feedLog.error("loadInitialData FAILED: \(error.localizedDescription, privacy: .public)")
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func loadMoreIfNeeded() async {
        guard !isLoading, !isRefreshing else { return }
        if !hasMore {
            // Recovery: if hasMore has been false for > 2 min, retry once.
            // Handles stale sessions where a bad response permanently blocked pagination.
            guard let falseAt = hasMoreBecameFalseAt,
                  Date().timeIntervalSince(falseAt) > 120 else { return }
            hasMoreBecameFalseAt = Date() // prevent rapid retries
            let added = await loadMoreBatch()
            if added == 0 && !hasMore {
                // Server confirmed no more — don't retry again for a while
                hasMoreBecameFalseAt = Date()
            }
            return
        }
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
                glancedIds: signals.glanced,
                skippedIds: signals.skipped,
                seenIds: existingIds
            )
            let existingSet = Set(existingIds)
            let newArticles = response.articles.filter { !existingSet.contains($0.id.stringValue) }
            allArticles.append(contentsOf: newArticles)
            nextCursor = response.nextCursor
            if response.hasMore {
                hasMore = true
                hasMoreBecameFalseAt = nil
            } else if hasMore {
                // Transition from true → false: record timestamp for recovery
                hasMore = false
                hasMoreBecameFalseAt = Date()
            }

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

    /// Pull-to-refresh: reload from scratch while preserving preferences.
    /// Sends reading history to prevent seen articles from reappearing.
    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        nextCursor = nil
        hasMore = true
        hasMoreBecameFalseAt = nil
        reRanker.reset()
        viewStartTimes.removeAll()
        isLoading = true
        errorMessage = nil
        do {
            // Fix 6: Merge current session IDs + persisted reading history for dedup
            let currentIds = allArticles.map { $0.id.stringValue }
            let persistedIds = ReadingHistoryManager.shared.seenArticleIds(limit: 500)
            let mergedSeenIds = Array(Set(currentIds + persistedIds))
            let feedResponse = try await feedService.fetchMainFeed(
                limit: fetchLimit,
                preferences: currentPreferences,
                userId: currentUserId,
                seenIds: mergedSeenIds
            )
            allArticles = feedResponse.articles
            nextCursor = feedResponse.nextCursor
            hasMore = feedResponse.hasMore
            rebuildArticleList()
            isLoading = false
            isRefreshing = false
            lastRefreshTime = Date()

            if articles.isEmpty && hasMore {
                await loadMoreUntilVisible()
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            isRefreshing = false
        }
    }

    /// Refresh only if data is stale (>5 min old). Call on app foreground / tab switch.
    func refreshIfStale(preferences: UserPreferences? = nil, userId: String? = nil) async {
        if let prefs = preferences { currentPreferences = prefs }
        if let uid = userId { currentUserId = uid }
        guard isStale else { return }

        if allArticles.isEmpty {
            await loadInitialData(preferences: currentPreferences, userId: currentUserId)
        } else {
            await refresh()
            currentIndex = 0
            recordViewStart(at: 0)
        }
    }

    // MARK: - Swipe Signal Tracking

    /// Call when a new card appears (user swiped to it)
    func recordViewStart(at index: Int) {
        let arts = articles
        guard index < arts.count else { return }
        viewStartTimes[arts[index].id.stringValue] = Date()
    }

    /// Call when user swipes back to a previously seen card — strong positive signal.
    func recordRevisit(at index: Int) {
        let arts = articles
        guard index < arts.count else { return }
        let article = arts[index]
        Task {
            try? await analytics.track(
                event: "article_revisit",
                articleId: Int(article.id.stringValue),
                category: article.category,
                metadata: ["index": String(index)]
            )
        }
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

        // Count as "read" if user spent more than 3 seconds
        if dwellSeconds >= 3.0 {
            ReadingHistoryManager.shared.recordRead(articleId: article.id.stringValue)
        }

        // Professional-grade tiered dwell tracking (TikTok/Pinterest style)
        // 7 tiers with continuous dwell weighting via metadata
        //   0-1s   → article_skipped (strong negative — instant rejection)
        //   1-3s   → article_skipped (mild negative — saw and passed)
        //   3-6s   → article_view (neutral/curious — glanced)
        //   6-12s  → article_engaged (mild positive — showed interest)
        //   12-25s → article_engaged (strong positive — read it)
        //   25-45s → article_engaged (very strong — deeply interested)
        //   45s+   → article_engaged (maximum — absorbed)
        let event: String
        let dwellTier: String
        if dwellSeconds < 1.0 {
            event = "article_skipped"
            dwellTier = "instant_skip"
        } else if dwellSeconds < 3.0 {
            event = "article_skipped"
            dwellTier = "quick_skip"
        } else if dwellSeconds < 6.0 {
            event = "article_view"
            dwellTier = "glance"
        } else if dwellSeconds < 12.0 {
            event = "article_engaged"
            dwellTier = "light_read"
        } else if dwellSeconds < 25.0 {
            event = "article_engaged"
            dwellTier = "engaged_read"
        } else if dwellSeconds < 45.0 {
            event = "article_engaged"
            dwellTier = "deep_read"
        } else {
            event = "article_engaged"
            dwellTier = "absorbed"
        }
        Task {
            try? await analytics.track(
                event: event,
                articleId: Int(article.id.stringValue),
                category: article.category,
                metadata: [
                    "dwell": String(format: "%.1f", dwellSeconds),
                    "total_active_seconds": String(format: "%.1f", dwellSeconds),
                    "dwell_tier": dwellTier,
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
            "Climate": "#339966", "Economy": "#228866",
            "Food": "#E07020", "Fashion": "#BB44AA", "Travel": "#2299BB", "Lifestyle": "#66AA44"
        ]
        let hex = categoryColors[article.category ?? ""] ?? "#3366CC"
        return Color(hex: hex)
    }
}
