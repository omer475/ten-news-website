import SwiftUI

struct SearchTabView: View {
    @Environment(TabBarState.self) private var tabBarState
    @State private var viewModel = SearchViewModel()
    @State private var selectedArticleId: FlexibleID?

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.backgroundPrimary.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        if viewModel.isLoading && !viewModel.hasSearched {
                            loadingState
                                .padding(.top, 8)
                        } else if viewModel.hasSearched {
                            resultsContent
                                .padding(.top, 8)
                        } else {
                            emptyStateContent
                                .padding(.top, 8)
                        }
                    }
                    .padding(.bottom, 100)
                }
                .collapsesTabBarOnScroll()
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.large)
            .task { await viewModel.loadTrending() }
            .onChange(of: tabBarState.searchText) { _, newValue in
                guard viewModel.searchText != newValue else { return }
                viewModel.searchText = newValue
                if newValue.isEmpty {
                    viewModel.articles = []
                    viewModel.entities = []
                    viewModel.hasSearched = false
                } else {
                    viewModel.onSearchTextChanged()
                }
            }
            .fullScreenCover(item: $selectedArticleId) { articleId in
                ArticleDetailView(articleId: articleId, initialArticle: nil)
            }
        }
    }

    private func openArticle(_ article: SearchArticle) {
        selectedArticleId = article.id
    }

    // MARK: - Empty State (before searching)

    private var emptyStateContent: some View {
        VStack(alignment: .leading, spacing: 28) {
            // Trending Now
            if !viewModel.trending.isEmpty {
                trendingSection
            }

            // Recent Searches
            if !viewModel.recentSearches.isEmpty {
                recentSearchesSection
            }

            // Browse Categories
            browseCategoriesSection
        }
    }

    // MARK: - Trending Section

    private var trendingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Trending Now")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.primary)
                .padding(.horizontal, 20)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(viewModel.trending) { entity in
                        Button {
                            tabBarState.searchText = entity.displayTitle
                            viewModel.selectTrending(entity)
                        } label: {
                            HStack(spacing: 6) {
                                Text(entity.emoji)
                                    .font(.system(size: 14))
                                Text(entity.displayTitle)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(.fill.quaternary)
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    // MARK: - Recent Searches Section

    private var recentSearchesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Recent")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.primary)

                Spacer()

                Button("Clear") {
                    withAnimation { viewModel.clearRecentSearches() }
                }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20)

            ForEach(viewModel.recentSearches, id: \.self) { query in
                Button {
                    tabBarState.searchText = query
                    viewModel.selectRecent(query)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "clock.arrow.circlepath")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.secondary)
                            .frame(width: 24)

                        Text(query)
                            .font(.system(size: 16))
                            .foregroundStyle(.primary)
                            .lineLimit(1)

                        Spacer()

                        Button {
                            withAnimation { viewModel.removeRecentSearch(query) }
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(.tertiary)
                                .frame(width: 24, height: 24)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Browse Categories

    private let browseColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    private var browseCategoriesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Browse")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.primary)
                .padding(.horizontal, 20)

            LazyVGrid(columns: browseColumns, spacing: 12) {
                ForEach(BrowseTopic.allTopics) { topic in
                    Button {
                        tabBarState.searchText = topic.name
                        viewModel.searchText = topic.name
                        Task { await viewModel.search(query: topic.name) }
                    } label: {
                        browseCard(topic)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func browseCard(_ topic: BrowseTopic) -> some View {
        RoundedRectangle(cornerRadius: 14)
            .fill(
                LinearGradient(
                    colors: [topic.color, topic.color.opacity(0.7)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(height: 80)
            .overlay(alignment: .topLeading) {
                Text(topic.name)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.leading, 14)
                    .padding(.top, 12)
            }
            .overlay(alignment: .bottomTrailing) {
                Image(systemName: topic.icon)
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(.white.opacity(0.3))
                    .rotationEffect(.degrees(15))
                    .offset(x: -10, y: -10)
            }
    }

    // MARK: - Results Content

    @ViewBuilder
    private var resultsContent: some View {
        if viewModel.isLoading && viewModel.articles.isEmpty && viewModel.errorMessage == nil {
            loadingState
        } else if let error = viewModel.errorMessage, viewModel.articles.isEmpty {
            searchErrorState(error)
        } else if viewModel.articles.isEmpty && viewModel.entities.isEmpty {
            noResultsState
        } else {
            let screenW = UIScreen.main.bounds.width
            let hPad: CGFloat = 16
            let gap: CGFloat = 8
            let fullW = screenW - hPad * 2
            let halfW = (fullW - gap) / 2

            LazyVStack(alignment: .leading, spacing: 0) {
                // Related topic pills
                relatedTopicPills
                    .padding(.bottom, 14)

                // Entity carousels
                ForEach(viewModel.entities) { entity in
                    entitySection(entity)
                        .padding(.bottom, 24)
                }

                // Mixed grid: hero card → 2-up row → full width → 2-up row → ...
                if !viewModel.articles.isEmpty {
                    let articles = viewModel.articles

                    LazyVStack(spacing: gap) {
                        // Hero: first article, tall
                        if let hero = articles.first {
                            Button { openArticle(hero) } label: {
                                SearchResultCard(
                                    article: hero,
                                    fallbackColor: categoryColor(for: hero.category ?? ""),
                                    cardWidth: fullW,
                                    cardHeight: fullW * 0.7,
                                    isHero: true
                                )
                            }
                            .buttonStyle(.plain)
                            .onAppear {
                                if hero.id.stringValue == articles.last?.id.stringValue {
                                    Task { await viewModel.loadMore() }
                                }
                            }
                        }

                        // Remaining articles in mixed pattern
                        ForEach(Array(mixedLayout(Array(articles.dropFirst())).enumerated()), id: \.offset) { _, row in
                            switch row {
                            case .pair(let a, let b):
                                HStack(spacing: gap) {
                                    Button { openArticle(a) } label: {
                                        SearchResultCard(
                                            article: a,
                                            fallbackColor: categoryColor(for: a.category ?? ""),
                                            cardWidth: halfW,
                                            cardHeight: halfW * 1.35
                                        )
                                    }
                                    .buttonStyle(.plain)
                                    .onAppear {
                                        if a.id.stringValue == articles.last?.id.stringValue {
                                            Task { await viewModel.loadMore() }
                                        }
                                    }
                                    Button { openArticle(b) } label: {
                                        SearchResultCard(
                                            article: b,
                                            fallbackColor: categoryColor(for: b.category ?? ""),
                                            cardWidth: halfW,
                                            cardHeight: halfW * 1.35
                                        )
                                    }
                                    .buttonStyle(.plain)
                                    .onAppear {
                                        if b.id.stringValue == articles.last?.id.stringValue {
                                            Task { await viewModel.loadMore() }
                                        }
                                    }
                                }
                            case .single(let a):
                                Button { openArticle(a) } label: {
                                    SearchResultCard(
                                        article: a,
                                        fallbackColor: categoryColor(for: a.category ?? ""),
                                        cardWidth: fullW,
                                        cardHeight: fullW * 0.55
                                    )
                                }
                                .buttonStyle(.plain)
                                .onAppear {
                                    if a.id.stringValue == articles.last?.id.stringValue {
                                        Task { await viewModel.loadMore() }
                                    }
                                }
                            case .solo(let a):
                                HStack(spacing: gap) {
                                    Button { openArticle(a) } label: {
                                        SearchResultCard(
                                            article: a,
                                            fallbackColor: categoryColor(for: a.category ?? ""),
                                            cardWidth: halfW,
                                            cardHeight: halfW * 1.35
                                        )
                                    }
                                    .buttonStyle(.plain)
                                    .onAppear {
                                        if a.id.stringValue == articles.last?.id.stringValue {
                                            Task { await viewModel.loadMore() }
                                        }
                                    }
                                    Spacer()
                                }
                            }
                        }
                    }
                    .padding(.horizontal, hPad)
                }

                // Loading indicator
                if viewModel.isLoading && !viewModel.articles.isEmpty {
                    HStack {
                        Spacer()
                        ProgressView()
                            .padding(.vertical, 20)
                        Spacer()
                    }
                }
            }
        }
    }

    // MARK: - Mixed Layout Engine

    private enum SearchRow: Identifiable {
        case pair(SearchArticle, SearchArticle)
        case single(SearchArticle)
        case solo(SearchArticle)

        var id: String {
            switch self {
            case .pair(let a, let b): "p-\(a.id.stringValue)-\(b.id.stringValue)"
            case .single(let a): "s-\(a.id.stringValue)"
            case .solo(let a): "o-\(a.id.stringValue)"
            }
        }
    }

    /// Pattern: 2-up, 2-up, full-width, repeat
    private func mixedLayout(_ articles: [SearchArticle]) -> [SearchRow] {
        var rows: [SearchRow] = []
        var i = 0
        var cycle = 0 // 0,1 = pair rows, 2 = full-width

        while i < articles.count {
            if cycle < 2 {
                // Pair row
                if i + 1 < articles.count {
                    rows.append(.pair(articles[i], articles[i + 1]))
                    i += 2
                } else {
                    rows.append(.solo(articles[i]))
                    i += 1
                }
                cycle += 1
            } else {
                // Full-width row
                rows.append(.single(articles[i]))
                i += 1
                cycle = 0
            }
        }
        return rows
    }

    // MARK: - Related Topic Pills

    /// Extract unique bold keywords from article titles as related sub-topics
    private var relatedTopics: [String] {
        let query = viewModel.searchText.lowercased()
        let pattern = /\*\*(.+?)\*\*/
        var seen = Set<String>()
        var topics: [String] = []

        for article in viewModel.articles {
            guard let title = article.title else { continue }
            for match in title.matches(of: pattern) {
                let keyword = String(match.1).trimmingCharacters(in: .whitespaces)
                let lower = keyword.lowercased()
                // Skip if it's the search query itself, too short, or already seen
                if lower == query || keyword.count < 2 || keyword.count > 24 || seen.contains(lower) { continue }
                seen.insert(lower)
                topics.append(keyword)
            }
        }
        return Array(topics.prefix(10))
    }

    @ViewBuilder
    private var relatedTopicPills: some View {
        let topics = relatedTopics
        if !topics.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(topics, id: \.self) { topic in
                        Button {
                            tabBarState.searchText = topic
                            viewModel.searchText = topic
                            Task { await viewModel.search(query: topic) }
                        } label: {
                            GlassEffectContainer {
                                HStack(spacing: 6) {
                                    Image(systemName: "magnifyingglass")
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundStyle(.secondary)
                                    Text(topic)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(.primary)
                                        .lineLimit(1)
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 9)
                                .glassEffect(.regular.tint(.white.opacity(0.05)), in: Capsule())
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: - Entity Section (Explore-style carousel)

    @State private var scrolledIndices: [String: Int] = [:]

    private var entityCardWidth: CGFloat {
        UIScreen.main.bounds.width - 80
    }

    private var entityCardHeight: CGFloat {
        entityCardWidth * 0.85
    }

    private func entitySection(_ entity: SearchEntity) -> some View {
        let catColor = categoryColor(for: entity.category)
        let currentIndex = scrolledIndices[entity.entityName] ?? 0

        return VStack(alignment: .leading, spacing: 12) {
            // Entity header
            HStack(spacing: 12) {
                Text(entity.emoji)
                    .font(.system(size: 22))

                VStack(alignment: .leading, spacing: 2) {
                    Text(entity.displayTitle)
                        .font(.system(size: 19, weight: .bold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    Text("\(entity.articles.count) articles")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 20)

            // Horizontal carousel
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(entity.articles) { article in
                        searchEntityCard(
                            article: article,
                            fallbackColor: catColor,
                            cardWidth: entityCardWidth,
                            cardHeight: entityCardHeight
                        )
                    }
                }
                .scrollTargetLayout()
                .padding(.horizontal, 20)
            }
            .scrollTargetBehavior(.viewAligned)
            .onScrollGeometryChange(for: CGFloat.self) { geo in
                geo.contentOffset.x
            } action: { _, newOffset in
                let page = Int(round(newOffset / (entityCardWidth + 12)))
                let clamped = max(0, min(page, entity.articles.count - 1))
                if scrolledIndices[entity.entityName] != clamped {
                    scrolledIndices[entity.entityName] = clamped
                }
            }

            // Page dots
            if entity.articles.count > 1 {
                SearchPageDots(count: entity.articles.count, current: currentIndex)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)
            }
        }
    }

    // MARK: - Entity Card (Explore-style)

    private func searchEntityCard(
        article: SearchArticle,
        fallbackColor: Color,
        cardWidth: CGFloat,
        cardHeight: CGFloat
    ) -> some View {
        ZStack {
            // Image
            if let urlStr = article.imageUrl, let url = URL(string: urlStr) {
                AsyncCachedImage(url: url, contentMode: .fill)
                    .frame(width: cardWidth, height: cardHeight)
                    .clipped()
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

            // Dark gradient
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

            // Glass layer
            Color.clear
                .frame(width: cardWidth, height: cardHeight)
                .glassEffect(
                    .regular.tint(fallbackColor),
                    in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                )
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0.0),
                            .init(color: .clear, location: 0.4),
                            .init(color: .white.opacity(0.2), location: 0.55),
                            .init(color: .white.opacity(0.4), location: 0.7),
                            .init(color: .white.opacity(0.6), location: 0.85),
                            .init(color: .white.opacity(0.7), location: 1.0),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .allowsHitTesting(false)

            // Content
            VStack(alignment: .leading, spacing: 6) {
                Spacer()

                HStack {
                    if !article.relativeTime.isEmpty {
                        Text(article.relativeTime)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                    Spacer()
                    if let category = article.category {
                        Text(category)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white.opacity(0.85))
                            .lineLimit(1)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                    }
                }

                Text(article.displayTitle)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(4)
                    .lineSpacing(2)
            }
            .frame(width: cardWidth - 32, alignment: .bottomLeading)
            .padding(.horizontal, 16)
            .padding(.bottom, 14)
        }
        .frame(width: cardWidth, height: cardHeight)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    // MARK: - Article Row

    private func articleRow(_ article: SearchArticle) -> some View {
        HStack(spacing: 14) {
            // Thumbnail
            if let urlStr = article.imageUrl, let url = URL(string: urlStr) {
                AsyncCachedImage(url: url, contentMode: .fill)
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(.fill.tertiary)
                    .frame(width: 80, height: 80)
                    .overlay {
                        Image(systemName: "newspaper.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(.quaternary)
                    }
            }

            // Text content
            VStack(alignment: .leading, spacing: 6) {
                Text(article.displayTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .lineSpacing(1)

                HStack(spacing: 6) {
                    if let category = article.category {
                        Text(category)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(categoryColor(for: category))
                    }

                    if article.category != nil && !article.relativeTime.isEmpty {
                        Circle()
                            .fill(.secondary.opacity(0.4))
                            .frame(width: 3, height: 3)
                    }

                    if !article.relativeTime.isEmpty {
                        Text(article.relativeTime)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    if let likes = article.likeCount, likes > 0 {
                        HStack(spacing: 3) {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 10))
                            Text("\(likes)")
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(.secondary.opacity(0.7))
                    }
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }

    // MARK: - Loading State

    private var loadingState: some View {
        let screenW = UIScreen.main.bounds.width
        let hPad: CGFloat = 16
        let gap: CGFloat = 8
        let fullW = screenW - hPad * 2
        let halfW = (fullW - gap) / 2

        return VStack(spacing: gap) {
            // Hero skeleton
            RoundedRectangle(cornerRadius: 16)
                .fill(.fill.tertiary)
                .frame(height: fullW * 0.7)

            // Pair skeleton
            HStack(spacing: gap) {
                RoundedRectangle(cornerRadius: 16)
                    .fill(.fill.tertiary)
                    .frame(height: halfW * 1.35)
                RoundedRectangle(cornerRadius: 16)
                    .fill(.fill.tertiary)
                    .frame(height: halfW * 1.35)
            }

            // Pair skeleton
            HStack(spacing: gap) {
                RoundedRectangle(cornerRadius: 16)
                    .fill(.fill.tertiary)
                    .frame(height: halfW * 1.35)
                RoundedRectangle(cornerRadius: 16)
                    .fill(.fill.tertiary)
                    .frame(height: halfW * 1.35)
            }

            // Full skeleton
            RoundedRectangle(cornerRadius: 16)
                .fill(.fill.tertiary)
                .frame(height: fullW * 0.55)
        }
        .padding(.horizontal, hPad)
        .redacted(reason: .placeholder)
        .shimmer()
        .padding(.top, 8)
    }

    // MARK: - No Results

    private var noResultsState: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 44))
                .foregroundStyle(.quaternary)
                .padding(.top, 40)

            Text("No results for \"\(viewModel.searchText)\"")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.secondary)

            Text("Try a different search term")
                .font(.system(size: 14))
                .foregroundStyle(.tertiary)

            // Show trending as fallback
            if !viewModel.trending.isEmpty {
                trendingSection
                    .padding(.top, 16)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Error State

    private func searchErrorState(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 44))
                .foregroundStyle(.quaternary)
                .padding(.top, 40)

            Text("Something went wrong")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.secondary)

            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)

            Button {
                Task { await viewModel.search(query: viewModel.searchText) }
            } label: {
                Text("Try Again")
                    .font(.system(size: 15, weight: .semibold))
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(.fill.tertiary, in: Capsule())
            }
        }
        .frame(maxWidth: .infinity)
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
            "Beauty": "#CC6699", "Lifestyle": "#CC9922", "Food": "#22AA66",
        ]
        return Color(hex: colors[category] ?? "#3366CC")
    }
}

// MARK: - Search Result Card (per-card dominant color extraction)

struct SearchResultCard: View {
    let article: SearchArticle
    let fallbackColor: Color
    let cardWidth: CGFloat
    let cardHeight: CGFloat
    var isHero: Bool = false
    var hideCategory: Bool = false

    @State private var dominantColor: Color?
    private var isCompact: Bool { cardWidth < 200 }
    private var titleSize: CGFloat { isHero ? 24 : (isCompact ? 15 : 20) }
    private var titleLines: Int { isHero ? 3 : (isCompact ? 3 : 2) }

    var body: some View {
        ZStack {
            // Image
            if let urlStr = article.imageUrl, let url = URL(string: urlStr) {
                AsyncCachedImage(url: url, contentMode: .fill, onLoaded: { img in
                    extractColor(from: url, image: img)
                })
                    .frame(width: cardWidth, height: cardHeight)
                    .clipped()
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

            // Dark gradient
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.0),
                    .init(color: .clear, location: 0.2),
                    .init(color: .black.opacity(0.3), location: 0.4),
                    .init(color: .black.opacity(0.6), location: 0.55),
                    .init(color: .black.opacity(0.85), location: 0.75),
                    .init(color: .black.opacity(0.95), location: 1.0),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(width: cardWidth, height: cardHeight)
            .allowsHitTesting(false)

            // Glass layer with dominant color
            Color.clear
                .frame(width: cardWidth, height: cardHeight)
                .glassEffect(
                    .regular.tint(Color(white: 0.1).opacity(0.5)),
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                )
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0.0),
                            .init(color: .clear, location: 0.25),
                            .init(color: .white.opacity(0.15), location: 0.38),
                            .init(color: .white.opacity(0.35), location: 0.50),
                            .init(color: .white.opacity(0.55), location: 0.62),
                            .init(color: .white.opacity(0.70), location: 0.75),
                            .init(color: .white.opacity(0.70), location: 1.0),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .allowsHitTesting(false)

            // Top-right: engagement badge for popular articles
            if let likes = article.likeCount, likes >= 5 {
                VStack {
                    HStack {
                        Spacer()
                        HStack(spacing: 4) {
                            Image(systemName: likes >= 10 ? "flame.fill" : "heart.fill")
                                .font(.system(size: 10, weight: .semibold))
                            Text("\(likes)")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                        .padding(10)
                    }
                    Spacer()
                }
            }

            // Content overlay
            VStack(alignment: .leading, spacing: isCompact ? 3 : 4) {
                Spacer()

                // Time + category row
                HStack(spacing: 6) {
                    if !article.relativeTime.isEmpty {
                        Text(article.relativeTime)
                            .font(.system(size: isCompact ? 10 : 12, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                    Spacer()
                    if let category = article.category, !isCompact, !hideCategory {
                        Text(category)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white.opacity(0.85))
                            .lineLimit(1)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                    }
                }

                // Title with highlighted colors
                (article.title ?? "Untitled").coloredTitle(
                    size: titleSize,
                    weight: .bold,
                    baseColor: .white,
                    highlightColor: (dominantColor ?? Color(white: 0.7)).vivid()
                )
                .lineLimit(titleLines)
                .lineSpacing(isCompact ? 1 : 2)
            }
            .padding(.horizontal, isCompact ? 10 : 16)
            .padding(.bottom, isCompact ? 10 : 14)
        }
        .frame(width: cardWidth, height: cardHeight)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Color Extraction (uses ArticleCardView's cache)

    /// Use ArticleCardView's color cache for consistent colors across feed and cards.
    /// If not cached, triggers the same extraction algorithm as the full article view.
    private func extractColor(from url: URL, image: UIImage) {
        // Check ArticleCardView's accent color cache first
        if let cached = ArticleCardView.colorCache.object(forKey: url as NSURL) {
            dominantColor = Color(cached)
            return
        }

        // Not cached yet — run the same extraction as ArticleCardView
        // by calling its extractDominantColor indirectly via the shared cache.
        // We replicate the exact same algorithm here for consistency.
        Task.detached(priority: .userInitiated) {
            guard let cgImage = image.cgImage else { return }

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

            // Same bucket + scoring as ArticleCardView.extractDominantColor
            struct ColorBucket {
                var count: Int = 0
                var bottomCount: Int = 0
                var positions: Set<String> = []
                var rKey: Int; var gKey: Int; var bKey: Int
            }

            var buckets: [String: ColorBucket] = [:]
            let totalPixels = sampleW * sampleH
            let bottomStart = sampleH / 2

            for i in stride(from: 0, to: totalPixels * 4, by: 10 * 4) {
                let r = Int(rawData[i]), g = Int(rawData[i + 1]), b = Int(rawData[i + 2]), a = Int(rawData[i + 3])
                if a < 125 || (r > 250 && g > 250 && b > 250) || (r < 10 && g < 10 && b < 10) { continue }
                let rK = (r / 15) * 15, gK = (g / 15) * 15, bK = (b / 15) * 15
                let key = "\(rK),\(gK),\(bK)"
                let pixelIdx = i / 4
                let px = (pixelIdx % sampleW) / 10
                let py = (pixelIdx / sampleW) / 10
                let isBottom = (pixelIdx / sampleW) >= bottomStart
                if buckets[key] == nil { buckets[key] = ColorBucket(rKey: rK, gKey: gK, bKey: bK) }
                buckets[key]!.count += 1
                if isBottom { buckets[key]!.bottomCount += 1 }
                buckets[key]!.positions.insert("\(px),\(py)")
            }

            guard !buckets.isEmpty else { return }

            let maxCount = CGFloat(buckets.values.map { $0.count }.max() ?? 1)
            let maxCoverage = CGFloat(buckets.values.map { $0.positions.count }.max() ?? 1)

            var accentCandidates: [(h: CGFloat, s: CGFloat, l: CGFloat, count: Int, coverage: Int, score: CGFloat)] =
                buckets.values.compactMap { bucket in
                    let hsl = ArticleCardView.rgbToHSL(CGFloat(bucket.rKey)/255, CGFloat(bucket.gKey)/255, CGFloat(bucket.bKey)/255)
                    guard hsl.s >= 35 && hsl.l >= 20 && hsl.l <= 80 else { return nil }
                    return (hsl.h, hsl.s, hsl.l, bucket.count, bucket.positions.count, 0)
                }

            if accentCandidates.isEmpty {
                if let fb = buckets.values.max(by: {
                    ArticleCardView.rgbToHSL(CGFloat($0.rKey)/255, CGFloat($0.gKey)/255, CGFloat($0.bKey)/255).s <
                    ArticleCardView.rgbToHSL(CGFloat($1.rKey)/255, CGFloat($1.gKey)/255, CGFloat($1.bKey)/255).s
                }) {
                    let hsl = ArticleCardView.rgbToHSL(CGFloat(fb.rKey)/255, CGFloat(fb.gKey)/255, CGFloat(fb.bKey)/255)
                    accentCandidates = [(hsl.h, hsl.s, hsl.l, fb.count, fb.positions.count, 0)]
                }
            }

            guard !accentCandidates.isEmpty else { return }

            for i in accentCandidates.indices {
                let c = accentCandidates[i]
                let normFreq = CGFloat(c.count) / maxCount
                let normSat = c.s / 100.0
                let normCov = CGFloat(c.coverage) / maxCoverage
                var score = normFreq * 0.50 + normSat * 0.30 + normCov * 0.20
                if c.h >= 200 && c.h <= 220 && c.s < 60 { score *= 0.85 }
                if c.h >= 15 && c.h <= 50 && c.s < 65 { score *= 0.7 }
                accentCandidates[i].score = score
            }

            let winner = accentCandidates.max(by: { $0.score < $1.score })!
            let accentS = min(90.0, winner.s * 1.15)
            let accentL: CGFloat = winner.l <= 40
                ? 55.0 + (winner.l / 40.0) * 10.0
                : 65.0 + ((winner.l - 40.0) / 40.0) * 10.0
            let accentCol = ArticleCardView.colorFromHSL(
                h: winner.h, s: max(65.0, accentS), l: max(55.0, min(75.0, accentL))
            )

            // Store in ArticleCardView's cache so all views share the same color
            ArticleCardView.colorCache.setObject(UIColor(accentCol), forKey: url as NSURL)

            await MainActor.run {
                withAnimation(.easeOut(duration: 0.3)) {
                    dominantColor = accentCol
                }
            }
        }
    }
}

// MARK: - Page Dots (matching Explore style)

private struct SearchPageDots: View {
    let count: Int
    let current: Int

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
