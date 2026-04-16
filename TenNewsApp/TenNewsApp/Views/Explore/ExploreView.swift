import SwiftUI

struct ExploreView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(FeedViewModel.self) private var feedViewModel
    @Environment(TabBarState.self) private var tabBarState
    @State private var topics: [ExploreTopic] = []
    @State private var isLoading = true
    @State private var searchText = ""
    @State private var selectedArticle: Article?
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
            if let article = selectedArticle {
                ExploreArticleSheet(
                    selectedArticle: article,
                    allArticles: feedViewModel.allArticles
                ) {
                    selectedArticle = nil
                }
                .ignoresSafeArea()
                .zIndex(1)
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
        let currentIndex = scrolledIndices[topic.entityName] ?? 0

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

            // Horizontal article scroll
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(Array(topic.articles.enumerated()), id: \.element.id) { index, article in
                        Button {
                            trackArticleTap(article, topic: topic)
                            openArticle(article)
                        } label: {
                            ExploreArticleCard(
                                article: article,
                                fallbackColor: catColor,
                                cardWidth: cardWidth,
                                cardHeight: cardHeight,
                                relatedEntities: relatedEntityNames(for: article, excluding: topic)
                            )
                        }
                        .buttonStyle(.plain)
                        .onAppear {
                            if index == 2 {
                                trackScrollIfNeeded(topic)
                            }
                        }
                    }
                }
                .scrollTargetLayout()
                .padding(.horizontal, 20)
            }
            .scrollTargetBehavior(.viewAligned)
            .onScrollGeometryChange(for: CGFloat.self) { geo in
                geo.contentOffset.x
            } action: { _, newOffset in
                let page = Int(round(newOffset / (cardWidth + 12)))
                let clamped = max(0, min(page, topic.articles.count - 1))
                let previousIndex = scrolledIndices[topic.entityName] ?? 0
                if clamped != previousIndex {
                    scrolledIndices[topic.entityName] = clamped
                    // Track swipe-right as interest signal (stronger than scroll, weaker than tap)
                    if clamped > previousIndex {
                        trackEntitySwipe(topic: topic, depth: clamped)
                    }
                }
            }

            // Page indicator dots (max 7 visible, iOS-style scaling)
            if topic.articles.count > 1 {
                PageDots(count: topic.articles.count, current: currentIndex)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)
            }
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

        // Check feed cache first
        if let cached = feedViewModel.allArticles.first(where: { $0.id.stringValue == topicArticle.id.stringValue }) {
            selectedArticle = cached
            return
        }

        // Open instantly with what we have, upgrade in background
        let fallback = Article.from(exploreArticle: topicArticle)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
            selectedArticle = fallback
        }

        Task {
            if let response: ArticleDetailResponse = try? await APIClient.shared.get(APIEndpoints.article(id: topicArticle.id.stringValue)) {
                selectedArticle = response.article
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

        Task {
            let loaded = await withTaskGroup(of: (Int, Article?).self) { group in
                for (index, topicArticle) in topic.articles.enumerated() {
                    group.addTask {
                        let response: ArticleDetailResponse? = try? await APIClient.shared.get(APIEndpoints.article(id: topicArticle.id.stringValue))
                        return (index, response?.article)
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

// MARK: - Explore Article Card (extracts dominant color from image)

struct ExploreArticleCard: View {
    let article: ExploreTopicArticle
    let fallbackColor: Color
    let cardWidth: CGFloat
    let cardHeight: CGFloat
    var relatedEntities: [String] = []

    @State private var dominantColor: Color?

    private var highlightColor: Color {
        (dominantColor ?? Color(white: 0.7)).vivid()
    }

    private var glassColor: Color {
        dominantColor ?? Color(white: 0.15)
    }

    /// Tags to show: related entities first, then bold keywords from title
    private var displayTags: [String] {
        if !relatedEntities.isEmpty { return relatedEntities }
        // Extract bold **keywords** from title
        let pattern = /\*\*(.+?)\*\*/
        var keywords: [String] = []
        for match in article.title.matches(of: pattern) {
            let word = String(match.1).trimmingCharacters(in: .whitespaces)
            if word.count >= 2 && word.count <= 18 {
                keywords.append(word)
            }
        }
        return keywords
    }

    var body: some View {
        ZStack {
            // Full-bleed image
            if let imageUrl = article.imageUrl, let url = URL(string: imageUrl) {
                AsyncCachedImage(url: url, contentMode: .fill)
                    .frame(width: cardWidth, height: cardHeight)
                    .clipped()
                    .onAppear { extractColor(from: url) }
            } else {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [fallbackColor.opacity(0.6), fallbackColor.opacity(0.2), Color(white: 0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: cardWidth, height: cardHeight)
            }

            // Dark gradient overlay for text readability
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.0),
                    .init(color: .clear, location: 0.3),
                    .init(color: .black.opacity(0.4), location: 0.45),
                    .init(color: .black.opacity(0.7), location: 0.6),
                    .init(color: .black.opacity(0.85), location: 0.75),
                    .init(color: .black.opacity(0.95), location: 1.0),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(width: cardWidth, height: cardHeight)
            .allowsHitTesting(false)

            // Liquid glass on top of dark gradient
            Color.clear
                .frame(width: cardWidth, height: cardHeight)
                .glassEffect(
                    .regular.tint(glassColor.opacity(0.45)),
                    in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                )
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0.0),
                            .init(color: .clear, location: 0.3),
                            .init(color: .white.opacity(0.15), location: 0.42),
                            .init(color: .white.opacity(0.35), location: 0.54),
                            .init(color: .white.opacity(0.55), location: 0.66),
                            .init(color: .white.opacity(0.70), location: 0.78),
                            .init(color: .white.opacity(0.70), location: 1.0),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .allowsHitTesting(false)

            // Bottom: time + keywords row, then title
            VStack(alignment: .leading, spacing: 6) {
                Spacer()

                // Time (left) + keyword tags (right) — same horizontal line
                HStack {
                    if !article.relativeTime.isEmpty {
                        Text(article.relativeTime)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.5))
                            .tracking(0.3)
                    }

                    Spacer()

                    HStack(spacing: 5) {
                        ForEach(displayTags.prefix(2), id: \.self) { tag in
                            GlassEffectContainer {
                                Text(tag)
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white.opacity(0.85))
                                    .lineLimit(1)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .glassEffect(.regular.tint(Color.black.opacity(0.25)), in: Capsule())
                            }
                        }
                    }
                }

                // Title — no line limit, show full text
                article.title.coloredTitle(
                    size: 26,
                    weight: .bold,
                    baseColor: .white,
                    highlightColor: highlightColor
                )
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)
            }
            .frame(width: cardWidth - 32, alignment: .bottomLeading)
            .padding(.horizontal, 16)
            .padding(.bottom, 14)
        }
        .frame(width: cardWidth, height: cardHeight)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    // MARK: - Dominant Color Extraction (lightweight, from cached image)

    private func extractColor(from url: URL) {
        // Use cached result if available
        if let cached = ArticleCardView.colorCache.object(forKey: url as NSURL) {
            dominantColor = Color(cached)
            return
        }

        Task.detached(priority: .background) {
            var uiImage: UIImage?
            for _ in 0..<15 {
                if let cached = AsyncCachedImage.cache.object(forKey: url as NSURL) {
                    uiImage = cached
                    break
                }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            if uiImage == nil {
                guard let (data, _) = try? await URLSession.shared.data(from: url),
                      let downloaded = UIImage(data: data) else { return }
                uiImage = downloaded
            }
            guard let uiImage, let cgImage = uiImage.cgImage else { return }

            let sampleW = min(cgImage.width, 80)
            let sampleH = min(cgImage.height, 80)
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            var rawData = [UInt8](repeating: 0, count: sampleW * sampleH * 4)

            guard let context = CGContext(
                data: &rawData, width: sampleW, height: sampleH,
                bitsPerComponent: 8, bytesPerRow: sampleW * 4, space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return }
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: sampleW, height: sampleH))

            // Bucket pixels into 15-unit RGB clusters (same as ArticleCardView)
            struct ColorBucket {
                var count: Int = 0
                var positions: Set<String> = []
                var rKey: Int
                var gKey: Int
                var bKey: Int
            }

            var buckets: [String: ColorBucket] = [:]
            let totalPixels = sampleW * sampleH

            for i in stride(from: 0, to: totalPixels * 4, by: 10 * 4) {
                let r = Int(rawData[i])
                let g = Int(rawData[i + 1])
                let b = Int(rawData[i + 2])
                let a = Int(rawData[i + 3])

                if a < 125 { continue }
                if r > 250 && g > 250 && b > 250 { continue }
                if r < 10 && g < 10 && b < 10 { continue }

                let rK = (r / 15) * 15
                let gK = (g / 15) * 15
                let bK = (b / 15) * 15
                let key = "\(rK),\(gK),\(bK)"

                let pixelIdx = i / 4
                let px = (pixelIdx % sampleW) / 10
                let py = (pixelIdx / sampleW) / 10

                if buckets[key] == nil {
                    buckets[key] = ColorBucket(rKey: rK, gKey: gK, bKey: bK)
                }
                buckets[key]!.count += 1
                buckets[key]!.positions.insert("\(px),\(py)")
            }

            guard !buckets.isEmpty else { return }

            // Convert to HSL, filter, and score (same as ArticleCardView)
            struct ScoredColor {
                let h: CGFloat, s: CGFloat, l: CGFloat
                let count: Int, coverage: Int
                var score: CGFloat = 0
            }

            let maxCount = CGFloat(buckets.values.map { $0.count }.max() ?? 1)
            let maxCoverage = CGFloat(buckets.values.map { $0.positions.count }.max() ?? 1)

            var candidates: [ScoredColor] = buckets.values.compactMap { bucket in
                let r = CGFloat(bucket.rKey) / 255.0
                let g = CGFloat(bucket.gKey) / 255.0
                let b = CGFloat(bucket.bKey) / 255.0
                let hsl = ArticleCardView.rgbToHSL(r, g, b)
                guard hsl.s >= 35 && hsl.l >= 20 && hsl.l <= 80 else { return nil }
                return ScoredColor(h: hsl.h, s: hsl.s, l: hsl.l, count: bucket.count, coverage: bucket.positions.count)
            }

            if candidates.isEmpty {
                let fallback = buckets.values.max(by: {
                    ArticleCardView.rgbToHSL(CGFloat($0.rKey)/255, CGFloat($0.gKey)/255, CGFloat($0.bKey)/255).s <
                    ArticleCardView.rgbToHSL(CGFloat($1.rKey)/255, CGFloat($1.gKey)/255, CGFloat($1.bKey)/255).s
                })
                if let fb = fallback {
                    let hsl = ArticleCardView.rgbToHSL(CGFloat(fb.rKey)/255, CGFloat(fb.gKey)/255, CGFloat(fb.bKey)/255)
                    candidates = [ScoredColor(h: hsl.h, s: hsl.s, l: hsl.l, count: fb.count, coverage: fb.positions.count)]
                }
            }

            guard !candidates.isEmpty else { return }

            for i in candidates.indices {
                let normFreq = CGFloat(candidates[i].count) / maxCount
                let normSat = candidates[i].s / 100.0
                let normCov = CGFloat(candidates[i].coverage) / maxCoverage
                var score = normFreq * 0.50 + normSat * 0.30 + normCov * 0.20
                if candidates[i].h >= 200 && candidates[i].h <= 220 && candidates[i].s < 60 { score *= 0.85 }
                if candidates[i].h >= 15 && candidates[i].h <= 50 && candidates[i].s < 65 { score *= 0.7 }
                candidates[i].score = score
            }

            candidates.sort { $0.score > $1.score }
            let winner = candidates[0]

            // Create accent color (same formula as ArticleCardView)
            let accentS = min(90.0, winner.s * 1.15)
            let accentL: CGFloat = winner.l <= 40
                ? 55.0 + (winner.l / 40.0) * 10.0
                : 65.0 + ((winner.l - 40.0) / 40.0) * 10.0
            let accentCol = ArticleCardView.colorFromHSL(
                h: winner.h,
                s: max(65.0, accentS),
                l: max(55.0, min(75.0, accentL))
            )

            // Cache so ArticleCardView uses the same color
            ArticleCardView.colorCache.setObject(UIColor(accentCol), forKey: url as NSURL)

            await MainActor.run {
                withAnimation(.easeOut(duration: 0.3)) {
                    dominantColor = accentCol
                }
            }
        }
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

    private let cardWidth: CGFloat = UIScreen.main.bounds.width - 40
    private var cardHeight: CGFloat { cardWidth }

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

                        ForEach(articles) { article in
                            Button {
                                HapticManager.selection()
                                selectedArticle = article
                            } label: {
                                ExploreArticleCard(
                                    article: matchingTopicArticle(for: article),
                                    fallbackColor: categoryColor(),
                                    cardWidth: cardWidth,
                                    cardHeight: cardHeight
                                )
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 20)
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
    }

    /// Find the matching ExploreTopicArticle for a full Article (for the card display)
    private func matchingTopicArticle(for article: Article) -> ExploreTopicArticle {
        if let match = topic.articles.first(where: { $0.id.stringValue == article.id.stringValue }) {
            return match
        }
        // Fallback: create one from the Article
        return ExploreTopicArticle(
            id: article.id,
            title: article.title ?? "Untitled",
            imageUrl: article.imageUrl,
            category: article.category,
            publishedAt: article.publishedAt
        )
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
