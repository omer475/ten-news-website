import SwiftUI

// MARK: - Article from ExploreTopicArticle

extension Article {
    /// Build a slim Article from an ExploreTopicArticle preview so the
    /// Explore page can render the same `ArticleCardContinuousView` as the
    /// main feed. Bullets carry markdown bold spans so entity-tap still works.
    /// All other Article fields (components, multi-page, details, scorecard,
    /// etc.) stay nil — the feed card falls into the simple title+bullets
    /// layout for these cards.
    static func fromExplore(_ e: ExploreTopicArticle, source: String? = nil) -> Article {
        Article(
            id: e.id,
            title: e.title,
            titleNews: nil,
            summary: nil,
            summaryText: nil,
            summaryTextB2: nil,
            summaryBullets: nil,
            summaryBulletsNews: e.bullets,
            summaryBulletsB2: nil,
            details: nil,
            detailsB2: nil,
            detailedText: nil,
            contentNews: nil,
            detailedBullets: nil,
            detailedBulletsB2: nil,
            url: nil,
            imageUrl: e.imageUrl,
            urlToImage: nil,
            imageSource: nil,
            source: source,
            category: e.category,
            emoji: nil,
            timeline: nil,
            graph: nil,
            graphData: nil,
            map: nil,
            mapData: nil,
            fiveWs: nil,
            components: nil,
            citations: nil,
            publishedAt: e.publishedAt,
            createdAt: nil,
            aiFinalScore: nil,
            finalScore: nil,
            baseScore: nil,
            rank: nil,
            worldEvent: nil,
            countries: nil,
            topics: nil,
            interestTags: nil,
            bucket: nil,
            resurfaced: nil,
            isResurfaced: nil,
            firstSeenAt: nil,
            wasEngaged: nil,
            countryRelevance: nil,
            topicRelevance: nil,
            matchReasons: nil,
            scorecard: nil,
            articleType: nil,
            authorId: nil,
            authorName: nil,
            pages: nil,
            expectedReadSeconds: nil
        )
    }
}

/// Deterministic hash-derived accent color for any article id. Same hue
/// formula as `TopicFeedView.accentColor(for:)` and `FeedViewModel.accentColor`,
/// so the same article shows the same accent everywhere.
private func exploreAccentColor(for id: FlexibleID) -> Color {
    let s = id.stringValue
    var hash: UInt64 = 14695981039346656037
    for byte in s.utf8 {
        hash = (hash ^ UInt64(byte)) &* 1099511628211
    }
    let hue = Double(hash % 360) / 360.0
    return Color(hue: hue, saturation: 0.55, brightness: 0.85)
}

/// PreferenceKey for collecting per-card measured heights inside an
/// `EntityArticleCarousel`. Each card emits `[index: height]`; the parent
/// `.onPreferenceChange` merges them into the carousel's `cardHeights`
/// state. Scoped per-carousel: each ScrollView is its own subtree, so two
/// carousels on screen don't cross-pollute.
private struct CardHeightKey: PreferenceKey {
    /// Computed getter (not a stored static var) to satisfy Swift 6 strict
    /// concurrency: stored mutable globals are flagged.
    static var defaultValue: [Int: CGFloat] { [:] }
    static func reduce(value: inout [Int: CGFloat], nextValue: () -> [Int: CGFloat]) {
        value.merge(nextValue(), uniquingKeysWith: { $1 })
    }
}

/// Horizontal swipe carousel where each card keeps its natural height
/// and the container morphs to match whichever card is currently snapped.
/// Each card has `.fixedSize(vertical: true)` so the parent's frame can't
/// compress it during measurement — without that, cards 2+ would all
/// report card 1's constrained height through the PreferenceKey and the
/// carousel would never resize.
private struct EntityArticleCarousel: View {
    let topic: ExploreTopic
    let cardWidth: CGFloat
    let prefetchedArticles: [String: Article]
    let preloadedArticles: [Article]
    var onTopicTap: (String) -> Void
    var onSwipeDepth: (Int) -> Void
    var onScrollHit: () -> Void

    @State private var cardHeights: [Int: CGFloat] = [:]
    @State private var currentIndex: Int = 0

    /// Height of the currently-snapped card. Falls back to a sensible
    /// estimate while the first measurement is in flight.
    private var currentHeight: CGFloat {
        cardHeights[currentIndex] ?? 600
    }

    /// Resolve the Article to render at a given carousel slot:
    /// prefetched full > already-loaded-in-feed > slim explore proxy.
    /// Pulled out of the ForEach body because the SwiftUI type-checker
    /// chokes on the deeply nested expression when it lives inline.
    private func resolvedArticle(at index: Int) -> Article {
        let article = topic.articles[index]
        let key = article.id.stringValue
        if let pre = prefetchedArticles[key] { return pre }
        if let loaded = preloadedArticles.first(where: { $0.id.stringValue == key }) { return loaded }
        return Article.fromExplore(article, source: topic.displayTitle)
    }

    var body: some View {
        VStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 12) {
                    ForEach(Array(topic.articles.enumerated()), id: \.element.id) { index, article in
                        ArticleCardContinuousView(
                            article: resolvedArticle(at: index),
                            accentColor: exploreAccentColor(for: article.id),
                            onTopicTap: onTopicTap,
                            showTopicTags: false
                        )
                        .frame(width: cardWidth)
                        // CRITICAL: card commits to its intrinsic height
                        // so the parent's .frame(height:) can't compress
                        // it during measurement. Without this, cards 2+
                        // would all measure at card 1's height.
                        .fixedSize(horizontal: false, vertical: true)
                        .background(
                            GeometryReader { geo in
                                Color.clear.preference(
                                    key: CardHeightKey.self,
                                    value: [index: geo.size.height]
                                )
                            }
                        )
                        .onAppear {
                            if index == 2 { onScrollHit() }
                        }
                    }
                }
                .scrollTargetLayout()
                .padding(.horizontal, 20)
            }
            .scrollTargetBehavior(.viewAligned)
            .onPreferenceChange(CardHeightKey.self) { heights in
                cardHeights.merge(heights, uniquingKeysWith: { _, new in new })
            }
            .frame(height: currentHeight)
            .clipped()
            .onScrollGeometryChange(for: CGFloat.self) { geo in
                geo.contentOffset.x
            } action: { _, newOffset in
                let page = Int(round(newOffset / (cardWidth + 12)))
                let clamped = max(0, min(page, topic.articles.count - 1))
                if clamped != currentIndex {
                    let prev = currentIndex
                    // Spring-animate the index flip so the carousel
                    // height change AND the section below sliding both
                    // ride the same animation curve.
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.85)) {
                        currentIndex = clamped
                    }
                    if clamped > prev { onSwipeDepth(clamped) }
                }
            }

            if topic.articles.count > 1 {
                PageDots(count: topic.articles.count, current: currentIndex)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)
            }
        }
    }
}

struct ExploreView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(FeedViewModel.self) private var feedViewModel
    @Environment(TabBarState.self) private var tabBarState
    @State private var topics: [ExploreTopic] = []
    @State private var isLoading = true
    @State private var searchText = ""
    @State private var selectedArticle: Article?
    /// Set when the user taps a bold entity on a feed-style explore card.
    /// Drives the same TopicFeedView full-screen cover that the main feed
    /// uses, for exact behavioural parity.
    @State private var topicTarget: TopicTarget? = nil
    /// Bumped on every write to `selectedArticle`. Article's `==` is id-only, so
    /// assigning a hydrated article over a stub (same id) is "equal" to @State
    /// and invalidation is skipped. Bumping this Int guarantees @State fires,
    /// and we key the sheet's `.id(...)` off it so SwiftUI rebuilds with the
    /// fresh article once bullets arrive.
    @State private var selectedArticleRev: Int = 0
    /// Full Articles prefetched in the background after topics load, so opens
    /// are instant (no stub→hydrate flicker). Keyed by article id string.
    @State private var prefetchedArticles: [String: Article] = [:]
    @State private var selectedTopic: ExploreTopic?
    @State private var topicArticles: [Article] = []
    @State private var loadingTopicArticles = false
    @State private var appeared = false
    @State private var lastLoadTime: Date?
    @State private var hasLoadedOnce = false
    private let staleThreshold: TimeInterval = 180 // 3 minutes

    // Explore tracking state
    private let analytics = AnalyticsService()
    @State private var dwellTimers: [String: Date] = [:]           // entity_name → expand start time
    @State private var dwellTracked: Set<String> = []              // debounce: once per topic per session
    @State private var scrollTracked: Set<String> = []             // debounce: once per topic per session

    private var userId: String? { appViewModel.currentUser?.id }

    private var filteredTopics: [ExploreTopic] {
        if searchText.isEmpty { return topics }
        return topics.filter {
            $0.displayTitle.localizedCaseInsensitiveContains(searchText) ||
            $0.category.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var personalizedTopics: [ExploreTopic] {
        filteredTopics.filter(\.isPersonalized)
    }

    private var trendingTopics: [ExploreTopic] {
        filteredTopics.filter(\.isTrending)
    }

    var body: some View {
        ZStack {
            Group {
                if topics.isEmpty {
                    loadingState
                } else {
                    mainContent
                }
            }
            .background(Theme.Colors.backgroundPrimary)
            .task {
                // Wait briefly for user state to load before first fetch
                if userId == nil {
                    try? await Task.sleep(nanoseconds: 300_000_000)
                }
                await loadTopics()
            }
            .refreshable { await loadTopics() }
            .onAppear {
                // Auto-refresh if data is stale (3+ minutes old)
                if let last = lastLoadTime, Date().timeIntervalSince(last) > staleThreshold {
                    Task { await loadTopics() }
                }
            }
            .onChange(of: appViewModel.currentUser?.id) { oldId, newId in
                // Reload when user becomes available or changes
                if oldId != newId {
                    Task { await loadTopics() }
                }
            }
            .onChange(of: tabBarState.exploreRefreshRequested) { _, requested in
                if requested {
                    tabBarState.exploreRefreshRequested = false
                    Task { await loadTopics() }
                }
            }

            // Article overlay (single article from card tap)
            // Topic feed cover — opened when the user taps a bold entity
            // on a feed-style card. Mirrors the main feed exactly.
            EmptyView()
                .fullScreenCover(item: $topicTarget) { target in
                    TopicFeedView(entity: target.entity)
                }

            if let article = selectedArticle {
                ExploreArticleSheet(
                    selectedArticle: article,
                    contentKey: article.contentKey,
                    allArticles: feedViewModel.allArticles
                ) {
                    selectedArticle = nil
                }
                .ignoresSafeArea()
                .zIndex(1)
                // Force SwiftUI to rebuild the sheet when the article is hydrated.
                // selectedArticleRev is bumped on every write to selectedArticle and
                // reliably changes even when the stub and full article are `==` equal
                // under Article's id-only Equatable.
                .id(selectedArticleRev)
            }

            // Topic overlay (entity tap — vertical pager of all entity articles)
            if selectedTopic != nil {
                EntityArticlesSheet(
                    topic: selectedTopic!,
                    articles: topicArticles,
                    isLoading: loadingTopicArticles
                ) {
                    // Fire dwell event on dismiss
                    if let topic = selectedTopic {
                        fireDwellEvent(topic)
                    }
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                        selectedTopic = nil
                        topicArticles = []
                    }
                }
                .transition(.move(edge: .bottom))
                .ignoresSafeArea()
                .zIndex(2)
            }
        }
    }

    // MARK: - Main Content

    private var mainContent: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: 0) {
                // Title scrolls with content
                Text("Explore")
                    .font(.system(size: 34, weight: .bold))
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                    .padding(.bottom, 28)

                // Topics — already interleaved (2 personalized, 1 trending) from API
                ForEach(Array(filteredTopics.enumerated()), id: \.element.id) { tIndex, topic in
                    entitySection(topic)
                        .sectionAppear(appeared: appeared, index: tIndex)
                        .padding(.bottom, 32)
                }

                Spacer(minLength: 100)
            }
        }
    }

    // MARK: - Category Group

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.primary)
            Text(title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.primary)
        }
        .padding(.horizontal, 20)
    }

    private func categoryIcon(for category: String) -> String {
        let icons: [String: String] = [
            "World": "globe.americas.fill", "Politics": "building.columns.fill",
            "Business": "briefcase.fill", "Tech": "cpu.fill",
            "Science": "atom", "Health": "heart.fill",
            "Sports": "sportscourt.fill", "Soccer": "soccerball",
            "Entertainment": "star.fill", "Finance": "chart.bar.fill",
            "Climate": "leaf.fill", "Economy": "banknote.fill",
            "Crypto": "bitcoinsign.circle.fill", "AI": "brain.head.profile.fill",
            "NFL": "football.fill", "NBA": "basketball.fill",
            "Baseball": "baseball.fill", "F1": "flag.checkered",
            "US Politics": "building.columns.fill", "World Politics": "globe.americas.fill",
            "AI & Tech": "cpu.fill", "K-Pop & Music": "music.note",
            "Motorsport": "flag.checkered", "Combat Sports": "figure.boxing",
            "Sports Events": "trophy.fill", "Automotive": "car.fill",
            "Gaming": "gamecontroller.fill", "Fashion": "tshirt.fill",
            "Skincare": "sparkles", "Beauty": "sparkles",
            "Lifestyle": "sun.max.fill", "Food": "fork.knife",
            "Music": "music.note",
        ]
        return icons[category] ?? "newspaper.fill"
    }

    // MARK: - Entity Section

    @State private var scrolledIndices: [String: Int] = [:]

    private func entitySection(_ topic: ExploreTopic) -> some View {
        let catColor = categoryColor(for: topic.category)
        let icon = categoryIcon(for: topic.category)

        return VStack(alignment: .leading, spacing: 12) {
            // Entity header — SF Symbol icon + bold name + chevron
            Button {
                openTopic(topic)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(catColor)
                        .frame(width: 34, height: 34)
                        .background(catColor.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(topic.displayTitle)
                            .font(.system(size: 19, weight: .bold))
                            .foregroundStyle(.primary)
                            .lineLimit(1)

                        Text(topic.category)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.tertiary)
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 20)

            // Horizontal swipe carousel of feed-style cards. Each card
            // stays at its natural height and the container morphs to
            // match the snapped card — see EntityArticleCarousel.
            EntityArticleCarousel(
                topic: topic,
                cardWidth: cardWidth,
                prefetchedArticles: prefetchedArticles,
                preloadedArticles: feedViewModel.allArticles,
                onTopicTap: { entity in
                    topicTarget = TopicTarget(entity: entity)
                },
                onSwipeDepth: { depth in
                    scrolledIndices[topic.entityName] = depth
                    trackEntitySwipe(topic: topic, depth: depth)
                },
                onScrollHit: { trackScrollIfNeeded(topic) }
            )
        }
    }

    // MARK: - Layout Constants

    private var cardWidth: CGFloat {
        UIScreen.main.bounds.width - 40
    }

    private var cardHeight: CGFloat { cardWidth }

    // MARK: - Loading

    private var loadingState: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: 28) {
                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 10) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(.fill.quaternary)
                            .frame(width: 120, height: 20)
                            .padding(.horizontal, 20)

                        VStack(alignment: .leading, spacing: 6) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(.fill.quaternary)
                                .frame(width: 160, height: 16)
                        }
                        .padding(.horizontal, 20)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 14) {
                                ForEach(0..<2, id: \.self) { _ in
                                    RoundedRectangle(cornerRadius: 18)
                                        .fill(.fill.tertiary)
                                        .frame(width: UIScreen.main.bounds.width - 40, height: UIScreen.main.bounds.width - 40)
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                    }
                    .redacted(reason: .placeholder)
                    .shimmer()
                }
            }
            .padding(.top, 16)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkle.magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.quaternary)

            Text("No Topics Yet")
                .font(.system(size: 18, weight: .semibold))

            Text("Topics will appear here based on your interests and trending stories.")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - API

    private func loadTopics() async {
        isLoading = true
        // Clean up tracking state on refresh to prevent unbounded growth
        dwellTimers.removeAll()
        dwellTracked.removeAll()
        scrollTracked.removeAll()
        scrolledIndices.removeAll()
        var params: [String] = []
        if let uid = userId {
            params.append("user_id=\(uid)")
        } else {
            // Guest users: send device ID so server can identify them
            let guestId = UserDefaults.standard.string(forKey: "guest_device_id") ?? UUID().uuidString
            params.append("guest_device_id=\(guestId)")
        }
        let prefs = appViewModel.preferences
        if let home = prefs.homeCountry {
            params.append("home_country=\(home)")
        }
        if !prefs.followedTopics.isEmpty {
            params.append("followed_topics=\(prefs.followedTopics.joined(separator: ","))")
        }
        // Exclude articles already shown in the feed
        let feedIds = feedViewModel.allArticles.prefix(30).compactMap { Int($0.id.stringValue) }
        if !feedIds.isEmpty {
            params.append("exclude_ids=\(feedIds.map(String.init).joined(separator: ","))")
        }
        let endpoint = "/api/explore/topics" + (params.isEmpty ? "" : "?\(params.joined(separator: "&"))")
        // Retry up to 3 times if empty (handles cold CDN cache, slow auth, etc.)
        for attempt in 1...3 {
            do {
                let response: ExploreTopicsResponse = try await APIClient.shared.get(endpoint)
                topics = response.topics
            } catch {
                // Keep existing data on refresh failure
            }
            if !topics.isEmpty { break }
            if attempt < 3 {
                try? await Task.sleep(nanoseconds: UInt64(attempt) * 500_000_000)
                // On retry, re-check userId in case it loaded late
                if userId != nil && !endpoint.contains("user_id") {
                    break // URL is stale, will reload via onChange
                }
            }
        }
        isLoading = false
        lastLoadTime = Date()
        withAnimation(.easeOut(duration: 0.4)) { appeared = true }

        // Prefetch full article details in the background so taps open with
        // bullets/details already in place. Runs after topics are visible so
        // the user isn't waiting on it — it just warms the cache.
        Task { await prefetchArticles() }
        // Also kick off image prefetching in parallel — different endpoints
        // (CDN vs our API) so the two don't compete. Most cards have heavy
        // hero images and waiting until LazyHStack lazily renders them is
        // why photos appeared late on first swipe.
        Task(priority: .utility) { await prefetchImages() }
    }

    /// Background image prefetcher. Walks topics in **round-robin order**
    /// so the first card of every topic gets prefetched before any topic's
    /// second card — the user can scroll to topic N's first card without
    /// waiting on topic 1's articles to download first. Delegates to
    /// `AsyncCachedImage.prefetch(_:)` so the prefetch + on-card load
    /// share the same URLSession + URLCache disk layer (cross-launch
    /// hits cut down on round-trips dramatically).
    private func prefetchImages() async {
        var urls: [URL] = []
        var seen = Set<String>()
        let perTopicCap = 10
        // Round-robin: first articles of every topic, then second, etc.
        for slot in 0..<perTopicCap {
            for topic in topics where slot < topic.articles.count {
                let article = topic.articles[slot]
                guard let s = article.imageUrl,
                      !s.isEmpty,
                      let url = URL(string: s) else { continue }
                let key = url.absoluteString
                if seen.contains(key) { continue }
                if AsyncCachedImage.cache.object(forKey: url as NSURL) != nil { continue }
                seen.insert(key)
                urls.append(url)
                if urls.count >= 120 { break }
            }
            if urls.count >= 120 { break }
        }
        guard !urls.isEmpty else { return }

        await withTaskGroup(of: Void.self) { group in
            for url in urls {
                group.addTask(priority: .utility) {
                    await AsyncCachedImage.prefetch(url)
                }
            }
        }
    }

    /// Fetches full Article details for the most-visible articles and stores them
    /// in `prefetchedArticles`. Caps at ~24 to bound work on cold loads.
    private func prefetchArticles() async {
        // Take up to 3 articles from each topic to cover the likely taps without
        // issuing dozens of requests.
        var ids: [String] = []
        var seen = Set<String>()
        for topic in topics {
            for article in topic.articles.prefix(3) {
                let key = article.id.stringValue
                if seen.contains(key) { continue }
                if prefetchedArticles[key] != nil { continue }
                if feedViewModel.allArticles.contains(where: { $0.id.stringValue == key }) { continue }
                seen.insert(key)
                ids.append(key)
                if ids.count >= 24 { break }
            }
            if ids.count >= 24 { break }
        }
        guard !ids.isEmpty else { return }

        let fetched = await withTaskGroup(of: (String, Article?).self) { group -> [String: Article] in
            for id in ids {
                group.addTask {
                    do {
                        let response: ArticleDetailResponse = try await APIClient.shared.get(APIEndpoints.article(id: id))
                        return (id, response.article)
                    } catch {
                        return (id, nil)
                    }
                }
            }
            var results: [String: Article] = [:]
            for await (id, article) in group {
                if let article { results[id] = article }
            }
            return results
        }

        await MainActor.run {
            for (id, article) in fetched { prefetchedArticles[id] = article }
        }
    }

    // MARK: - Related Entities

    /// Find other topic names that also contain this article (excluding the current topic)
    private func relatedEntityNames(for article: ExploreTopicArticle, excluding currentTopic: ExploreTopic) -> [String] {
        topics.compactMap { topic in
            guard topic.entityName != currentTopic.entityName else { return nil }
            guard topic.articles.contains(where: { $0.id.stringValue == article.id.stringValue }) else { return nil }
            return topic.displayTitle
        }
    }

    // MARK: - Open Article

    private func openArticle(_ topicArticle: ExploreTopicArticle) {
        HapticManager.selection()

        let id = topicArticle.id.stringValue

        // Prefetched full article in hand? Open instantly with complete content.
        if let prefetched = prefetchedArticles[id] {
            selectedArticle = prefetched
            selectedArticleRev &+= 1
            return
        }

        // Check feed cache — full article already in memory, no fetch needed.
        if let cached = feedViewModel.allArticles.first(where: { $0.id.stringValue == id }) {
            selectedArticle = cached
            selectedArticleRev &+= 1
            return
        }

        // Open instantly with a stub (title + photo only), upgrade to full article
        // once the network call returns.
        let fallback = Article.from(exploreArticle: topicArticle)
        let requestedId = fallback.id
        withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
            selectedArticle = fallback
            selectedArticleRev &+= 1
        }

        // Task MUST be @MainActor — the assignment to `selectedArticle` drives SwiftUI
        // state and must happen on the main actor. Without this, the update is silently
        // dropped off a background thread and the sheet never hydrates beyond the stub.
        Task { @MainActor in
            do {
                let response: ArticleDetailResponse = try await APIClient.shared.get(
                    APIEndpoints.article(id: topicArticle.id.stringValue)
                )
                guard selectedArticle?.id == requestedId else { return }
                selectedArticle = response.article
                selectedArticleRev &+= 1
            } catch {
                print("❌ openArticle: failed id=\(topicArticle.id.stringValue): \(error)")
            }
        }
    }

    // MARK: - Open Topic (entity tap)

    private func openTopic(_ topic: ExploreTopic) {
        HapticManager.selection()
        trackTopicTap(topic)
        startDwellTimer(topic)
        selectedTopic = topic
        loadingTopicArticles = true
        topicArticles = []

        Task { @MainActor in
            let loaded = await withTaskGroup(of: (Int, Article?).self) { group in
                for (index, topicArticle) in topic.articles.enumerated() {
                    group.addTask {
                        do {
                            let response: ArticleDetailResponse = try await APIClient.shared.get(
                                APIEndpoints.article(id: topicArticle.id.stringValue)
                            )
                            return (index, response.article)
                        } catch {
                            print("❌ openTopic: failed to hydrate id=\(topicArticle.id.stringValue): \(error)")
                            return (index, nil)
                        }
                    }
                }
                var results: [(Int, Article)] = []
                for await (index, article) in group {
                    if let article { results.append((index, article)) }
                }
                return results.sorted(by: { $0.0 < $1.0 }).map(\.1)
            }
            topicArticles = loaded
            loadingTopicArticles = false
        }
    }

    // MARK: - Explore Tracking

    /// Track topic card tap (+0.02 to entity)
    private func trackTopicTap(_ topic: ExploreTopic) {
        Task {
            try? await analytics.track(
                event: "explore_topic_tap",
                category: topic.category,
                source: "explore",
                metadata: ["entity_name": topic.entityName]
            )
        }
    }

    /// Start dwell timer when topic is expanded
    private func startDwellTimer(_ topic: ExploreTopic) {
        dwellTimers[topic.entityName] = Date()
    }

    /// Fire dwell event when topic is collapsed or user navigates away
    private func fireDwellEvent(_ topic: ExploreTopic) {
        guard !dwellTracked.contains(topic.entityName),
              let startTime = dwellTimers[topic.entityName] else { return }

        let dwellSeconds = Date().timeIntervalSince(startTime)
        guard dwellSeconds >= 2.0 else { return } // ignore very short dwells

        dwellTracked.insert(topic.entityName)
        dwellTimers.removeValue(forKey: topic.entityName)

        Task {
            try? await analytics.track(
                event: "explore_topic_dwell",
                category: topic.category,
                source: "explore",
                metadata: [
                    "entity_name": topic.entityName,
                    "dwell_seconds": String(format: "%.1f", dwellSeconds)
                ]
            )
        }
    }

    /// Track article tap from explore (+0.06 to entity + article tags)
    private func trackArticleTap(_ topicArticle: ExploreTopicArticle, topic: ExploreTopic) {
        Task {
            try? await analytics.track(
                event: "explore_article_tap",
                articleId: Int(topicArticle.id.stringValue),
                category: topic.category,
                source: "explore",
                metadata: ["entity_name": topic.entityName]
            )
        }
    }

    /// Track swipe-right within entity carousel — interest signal
    private func trackEntitySwipe(topic: ExploreTopic, depth: Int) {
        Task {
            try? await analytics.track(
                event: "explore_entity_swipe",
                category: topic.category,
                source: "explore",
                metadata: ["entity_name": topic.entityName, "depth": String(depth)]
            )
        }
    }

    /// Track horizontal scroll (3+ articles seen) — once per topic per session
    private func trackScrollIfNeeded(_ topic: ExploreTopic) {
        guard !scrollTracked.contains(topic.entityName) else { return }
        scrollTracked.insert(topic.entityName)

        Task {
            try? await analytics.track(
                event: "explore_topic_scroll",
                category: topic.category,
                source: "explore",
                metadata: ["entity_name": topic.entityName]
            )
        }
    }

    // MARK: - Helpers

    private func categoryColor(for category: String) -> Color {
        let colors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Soccer": "#DD6622", "Entertainment": "#CC9922",
            "Finance": "#228866", "Climate": "#339966", "Economy": "#228866",
            "Crypto": "#F7931A", "AI": "#7744BB", "NFL": "#013369",
            "NBA": "#C9082A", "Baseball": "#002D72", "F1": "#E10600",
            "US Politics": "#CC3344", "World Politics": "#3366CC",
            "AI & Tech": "#7744BB", "K-Pop & Music": "#CC9922",
            "Motorsport": "#E10600", "Combat Sports": "#DD6622",
            "Sports Events": "#DD6622", "Automotive": "#336699",
            "Gaming": "#7744BB", "Fashion": "#CC6699", "Skincare": "#CC6699",
            "Beauty": "#CC6699", "Food": "#E07020", "Travel": "#2299BB",
            "Lifestyle": "#66AA44",
        ]
        return Color(hex: colors[category] ?? "#3366CC")
    }
}

// MARK: - Section Appear Modifier

private struct SectionAppearModifier: ViewModifier {
    let appeared: Bool
    let index: Int

    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 20)
            .animation(
                .spring(response: 0.5, dampingFraction: 0.8)
                    .delay(Double(index) * 0.08),
                value: appeared
            )
    }
}

extension View {
    fileprivate func sectionAppear(appeared: Bool, index: Int) -> some View {
        modifier(SectionAppearModifier(appeared: appeared, index: index))
    }
}

// MARK: - Entity Articles Sheet (vertical pager for all articles in an entity)

struct EntityArticlesSheet: View {
    let topic: ExploreTopic
    let articles: [Article]
    let isLoading: Bool
    let onDismiss: () -> Void

    @State private var selectedArticle: Article?
    /// Set when the user taps a bold entity inside a feed card. Drives a
    /// nested TopicFeedView cover, same as the main feed.
    @State private var nestedTopicTarget: TopicTarget? = nil

    private func categoryColor() -> Color {
        let colors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
            "Climate": "#339966", "Economy": "#228866",
        ]
        return Color(hex: colors[topic.category] ?? "#3366CC")
    }

    private static func accentColor(for article: Article) -> Color {
        let categoryColors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
            "Climate": "#339966", "Economy": "#228866",
        ]
        let hex = categoryColors[article.category ?? ""] ?? "#3366CC"
        return Color(hex: hex)
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Theme.Colors.backgroundPrimary.ignoresSafeArea()

            if isLoading && articles.isEmpty {
                VStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                // Vertical scroll of article cards with title inside
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 8) {
                        // Title scrolls with content
                        HStack {
                            Text(topic.displayTitle)
                                .font(.system(size: 28, weight: .bold))
                                .foregroundStyle(.primary)

                            Spacer()

                            Text("\(topic.articles.count) articles")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.secondary)
                        }
                        .padding(.leading, 68)
                        .padding(.trailing, 20)
                        .padding(.top, 66)

                        VStack(spacing: 18) {
                            ForEach(articles) { article in
                                ArticleCardContinuousView(
                                    article: article,
                                    accentColor: exploreAccentColor(for: article.id),
                                    onTopicTap: { entity in
                                        nestedTopicTarget = TopicTarget(entity: entity)
                                    },
                                    showTopicTags: false
                                )
                            }
                        }
                        .padding(.bottom, 100)
                    }
                }
            }

            // Fixed back button — always visible
            Button {
                onDismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)
                    .frame(width: 38, height: 38)
                    .glassEffect(.regular, in: Circle())
            }
            .buttonStyle(.plain)
            .padding(.top, 64)
            .padding(.leading, 20)

            // Article detail overlay
            if let article = selectedArticle {
                ExploreArticleSheet(
                    selectedArticle: article,
                    contentKey: article.contentKey,
                    allArticles: articles,
                    onDismiss: {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                            selectedArticle = nil
                        }
                    },
                    preserveOrder: true
                )
                .transition(.move(edge: .bottom))
                .ignoresSafeArea()
                .zIndex(1)
            }
        }
        .fullScreenCover(item: $nestedTopicTarget) { target in
            TopicFeedView(entity: target.entity)
        }
    }
}

// MARK: - Page Indicator Dots (iOS-style, max 7 visible with scaling)

private struct PageDots: View {
    let count: Int
    let current: Int

    // Show at most 7 dots; a sliding window follows the active index
    private let maxVisible = 7

    private var windowRange: ClosedRange<Int> {
        if count <= maxVisible { return 0...(count - 1) }
        let half = maxVisible / 2
        let lo = min(max(current - half, 0), count - maxVisible)
        let hi = lo + maxVisible - 1
        return lo...hi
    }

    var body: some View {
        HStack(spacing: 5) {
            ForEach(Array(windowRange), id: \.self) { i in
                let distance = abs(i - current)
                let isEdge = (i == windowRange.lowerBound && i != 0) ||
                             (i == windowRange.upperBound && i != count - 1)

                Circle()
                    .fill(Color.primary.opacity(i == current ? 1.0 : max(0.15, 0.4 - Double(distance) * 0.08)))
                    .frame(
                        width: i == current ? 7 : (isEdge ? 4 : 5.5),
                        height: i == current ? 7 : (isEdge ? 4 : 5.5)
                    )
            }
        }
        .animation(.snappy(duration: 0.25), value: current)
    }
}
