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
    // Audit fix B11 (2026-05-06): accumulated dwell across pause/resume
    // boundaries (background, sheet presented, Safari open). Without this,
    // a 30-min phone lock produced a 1800s "absorbed" engagement.
    private var viewDwellAccum: [String: TimeInterval] = [:]
    private var dwellPaused = false
    // Continuous-feed revisit tracking: ids the user has scrolled PAST at
    // least once. On the next onAppear for the same id we fire
    // article_revisit (X-style ranker's strongest positive, weight 12.0).
    // Cleared on `refresh()` so a fresh feed starts clean.
    private var departedArticleIds: Set<String> = []
    private(set) var lastRefreshTime: Date?

    // Phase 9.2 (2026-04-24): prefetch-vs-freshness coordination.
    // Set the instant an engagement/skip POST is fired; loadMoreIfNeeded
    // waits briefly if this timestamp is very recent, so the event lands
    // server-side before the next-page retrieval closes its snapshot.
    private var lastEventSentAt: Date?
    private let prefetchDebounceWindow: TimeInterval = 0.20

    private let feedService = FeedService()
    private let eventService = WorldEventService()
    private let analytics = AnalyticsService()

    // MARK: - Feed Cache (instant load on app open)

    private static let cacheKey = "cached_feed_articles"
    private static let cacheTimeKey = "cached_feed_time"

    /// Save current articles to disk for instant next-open.
    private func saveFeedCache() {
        guard !allArticles.isEmpty else { return }
        // Cache first 20 articles only (keep it small)
        let toCache = Array(allArticles.prefix(20))
        if let data = try? JSONEncoder().encode(toCache) {
            UserDefaults.standard.set(data, forKey: Self.cacheKey)
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.cacheTimeKey)
        }
    }

    /// Load cached articles. Returns nil if cache is empty, older than 2 hours,
    /// or suspiciously small (< 5 articles — likely a stale "caught_up" cache
    /// from a broken session). Skipping tiny caches forces a fresh fetch on
    /// launch instead of showing a 1-article frozen feed.
    private func loadFeedCache() -> [Article]? {
        let cachedTime = UserDefaults.standard.double(forKey: Self.cacheTimeKey)
        guard cachedTime > 0, Date().timeIntervalSince1970 - cachedTime < 7200 else { return nil }
        guard let data = UserDefaults.standard.data(forKey: Self.cacheKey),
              let cached = try? JSONDecoder().decode([Article].self, from: data),
              cached.count >= 5 else { return nil }
        return cached
    }

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
        errorMessage = nil
        currentPreferences = preferences
        currentUserId = userId
        // v5.1 fix #8: do NOT reset reRanker on launch. SessionReRanker now
        // persists state across launches via UserDefaults (24h sliding TTL),
        // so a power user opening the app 5× a day keeps a single growing
        // session context instead of 5 cold-start contexts. Manual refresh()
        // still calls reset() — that path is an explicit "wipe my context"
        // signal from the user.

        // Step 1: Show cached articles IMMEDIATELY if available
        if let cached = loadFeedCache() {
            allArticles = cached
            rebuildArticleList()
            isLoading = false
            isRefreshing = true  // subtle indicator, not a blocking spinner
            feedLog.warning("loadInitialData: showing \(cached.count) cached articles instantly")
        } else {
            isLoading = true  // first-ever load, must wait
        }

        // Step 2: Fetch fresh feed (runs regardless, replaces cache)
        do {
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
            isRefreshing = false
            lastRefreshTime = Date()
            saveFeedCache()

            feedLog.warning("loadInitialData: \(feedResponse.articles.count) articles, hasMore=\(feedResponse.hasMore), feedState=\(self.feedState, privacy: .public), freshCount=\(self.freshCount), total=\(feedResponse.total ?? -1), cursor=\(feedResponse.nextCursor ?? "nil", privacy: .public), userId=\(userId ?? "nil", privacy: .public)")

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
            // If we already showed cached articles, user has content — just stop refreshing
            if !allArticles.isEmpty {
                isRefreshing = false
            } else {
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }

    func loadMoreIfNeeded() async {
        guard !isLoading, !isRefreshing else { return }
        // Phase 9.2: if a skip/engage POST just fired, give it a moment to
        // land on the server before the retrieval snapshot closes. Without
        // this the session_skipped/engaged IDs the server reads from our
        // query string are client-local only — but the server also cross-
        // references recent user_article_events when computing session
        // topics, which lags by ~100-300 ms.
        if let last = lastEventSentAt {
            let elapsed = Date().timeIntervalSince(last)
            if elapsed < prefetchDebounceWindow {
                let wait = prefetchDebounceWindow - elapsed
                try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
            }
        }
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
                skipDwellsJSON: reRanker.sessionSkipDwellsJSON,  // Phase F (feed v11)
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
        departedArticleIds.removeAll()
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
            saveFeedCache()

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
    ///
    /// Fix α: when the previous response was `caught_up`, ALWAYS clear the state
    /// and force a refresh — regardless of the 5-minute `isStale` threshold.
    /// Otherwise a stale "you're all caught up" banner can persist through a
    /// short background/foreground cycle and the feed appears frozen.
    func refreshIfStale(preferences: UserPreferences? = nil, userId: String? = nil) async {
        if let prefs = preferences { currentPreferences = prefs }
        if let uid = userId { currentUserId = uid }

        let wasCaughtUp = (feedState == "caught_up" || feedState == "mostly_caught_up")
        if wasCaughtUp {
            feedState = "normal"
            caughtUpMessage = nil
        }

        let shouldRefresh = isStale || wasCaughtUp
        guard shouldRefresh else { return }

        if allArticles.isEmpty {
            await loadInitialData(preferences: currentPreferences, userId: currentUserId)
        } else {
            await refresh()
            currentIndex = 0
            recordViewStart(at: 0)
        }
    }

    // MARK: - Swipe Signal Tracking

    /// Call when a new card appears (user scrolled to it). Fires
    /// `article_revisit` if the user has departed this card before — the
    /// X-style ranker (Phase 2) weights revisit at 12.0, the strongest
    /// single positive. Without this hook revisit is never fired on the
    /// continuous feed (the old VerticalPager-only `newIndex < oldIndex`
    /// path is gone).
    func recordViewStart(at index: Int) {
        let arts = articles
        guard index < arts.count else { return }
        let id = arts[index].id.stringValue
        if departedArticleIds.contains(id) {
            recordRevisit(at: index)
        }
        // Reset accumulated for a fresh dwell measurement (whether first view
        // or revisit — we want time-on-card from each appearance separately).
        viewDwellAccum.removeValue(forKey: id)
        viewStartTimes[id] = Date()
    }

    // MARK: - Audit fix B11 — Dwell pause/resume

    /// Pause the in-flight dwell timer for the currently-visible card.
    /// Call when scenePhase leaves .active (background, inactive) or when a
    /// sheet/Safari is presented over the feed. Accumulates elapsed time so
    /// the next resume picks up where we left off.
    func pauseDwellTracking() {
        guard !dwellPaused else { return }
        let now = Date()
        for (id, start) in viewStartTimes {
            let elapsed = now.timeIntervalSince(start)
            viewDwellAccum[id] = (viewDwellAccum[id] ?? 0) + max(0, elapsed)
        }
        viewStartTimes.removeAll()
        dwellPaused = true
    }

    /// Resume dwell tracking on the currently-visible card.
    /// Call when scenePhase becomes .active or sheet is dismissed.
    func resumeDwellTracking() {
        guard dwellPaused else { return }
        dwellPaused = false
        let arts = articles
        guard currentIndex < arts.count else { return }
        viewStartTimes[arts[currentIndex].id.stringValue] = Date()
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
        // Mark the article as departed so the next onAppear is recognised as
        // a revisit (continuous-feed scroll-back signal). See recordViewStart.
        departedArticleIds.insert(article.id.stringValue)
        // Audit fix B11 (2026-05-06): pause-aware dwell. When the app is
        // backgrounded or a sheet is presented, pauseDwellTracking()
        // accumulates the in-flight elapsed into viewDwellAccum and clears
        // viewStartTimes. resumeDwellTracking() restarts the timer from the
        // current moment. Total dwell = accumulated + (now - start).
        // Cap retained at 120s as a safety net against any uncovered
        // pause path.
        let id = article.id.stringValue
        let accum = viewDwellAccum[id] ?? 0
        let liveSegment: TimeInterval
        if let start = viewStartTimes[id] {
            liveSegment = max(0, Date().timeIntervalSince(start))
        } else {
            liveSegment = 0
        }
        let rawDwell = accum + liveSegment
        let dwellSeconds = min(rawDwell, 120.0)
        viewStartTimes.removeValue(forKey: id)
        viewDwellAccum.removeValue(forKey: id)

        // Audit fix B5+B6 (2026-05-06): unified DwellTier classification +
        // Kuaishou WTG / TikTok pCompletion read-ratio support. When
        // `expected_read_seconds` is in the article payload, classify by
        // dwell/expected ratio instead of absolute seconds — a 30s dwell
        // on a 60-word card and a 30s dwell on a 200-word card no longer
        // collapse to the same tier. Falls back to absolute thresholds
        // when expected is missing.
        //
        // Classify ONCE here, pass the tier to BOTH the on-device reranker
        // AND the analytics event so both apply consistent weighting.
        let tier = DwellTier.classify(dwell: dwellSeconds, expected: article.expectedReadSeconds)
        reRanker.recordSignal(article: article, dwellSeconds: dwellSeconds, tier: tier)

        // Count as "read" if user spent more than 3 seconds
        if dwellSeconds >= 3.0 {
            ReadingHistoryManager.shared.recordRead(articleId: article.id.stringValue)
        }
        let readRatio: String? = article.expectedReadSeconds.flatMap { exp in
            exp > 0 ? String(format: "%.2f", dwellSeconds / exp) : nil
        }
        lastEventSentAt = Date()
        Task {
            var meta: [String: String] = [
                "dwell": String(format: "%.1f", dwellSeconds),
                "total_active_seconds": String(format: "%.1f", dwellSeconds),
                "dwell_tier": tier.rawValue,
                "bucket": article.bucket ?? "unknown"
            ]
            if let r = readRatio { meta["read_ratio"] = r }
            if let exp = article.expectedReadSeconds {
                meta["expected_read_seconds"] = String(format: "%.1f", exp)
            }
            try? await analytics.track(
                event: tier.analyticsEvent,
                articleId: Int(article.id.stringValue),
                category: article.category,
                metadata: meta
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
