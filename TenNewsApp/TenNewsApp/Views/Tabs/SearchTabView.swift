import SwiftUI

struct SearchTabView: View {
    @Environment(TabBarState.self) private var tabBarState
    @Environment(AppViewModel.self) private var appViewModel
    @State private var viewModel = SearchViewModel()
    @State private var selectedArticle: Article?
    @State private var fetchedArticles: [Article] = []
    @State private var isLoadingArticle = false
    @State private var searchFilter: SearchFilter = .content
    @State private var selectedPublisherId: String?
    @State private var showPublisherProfile = false

    private let articleService = ArticleService()

    enum SearchFilter: String, CaseIterable {
        case content = "Content"
        case profiles = "Profiles"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.backgroundPrimary.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        // Filter tabs — only show when searching
                        if viewModel.hasSearched {
                            HStack(spacing: 0) {
                                ForEach(SearchFilter.allCases, id: \.self) { filter in
                                    Button {
                                        withAnimation(.easeInOut(duration: 0.2)) { searchFilter = filter }
                                    } label: {
                                        Text(filter.rawValue)
                                            .font(.system(size: 14, weight: .semibold))
                                            .foregroundStyle(searchFilter == filter ? .white : .white.opacity(0.4))
                                            .frame(maxWidth: .infinity)
                                            .frame(height: 36)
                                            .background(
                                                searchFilter == filter ? .white.opacity(0.12) : .clear,
                                                in: RoundedRectangle(cornerRadius: 10)
                                            )
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.top, 4)
                            .padding(.bottom, 8)
                        }

                        if viewModel.isLoading && !viewModel.hasSearched {
                            loadingState
                                .padding(.top, 8)
                        } else if viewModel.hasSearched {
                            if searchFilter == .content {
                                resultsContent
                                    .padding(.top, 8)
                            } else {
                                publisherResults
                                    .padding(.top, 8)
                            }
                        } else {
                            emptyStateContent
                                .padding(.top, 8)
                        }
                    }
                    .padding(.bottom, 100)
                }
                .collapsesTabBarOnScroll()
                .scrollDismissesKeyboard(.interactively)

                // Article card overlay — vertical pager through search results
                if let article = selectedArticle {
                    ExploreArticleSheet(
                        selectedArticle: article,
                        contentKey: article.contentKey,
                        allArticles: fetchedArticles,
                        onDismiss: {
                            selectedArticle = nil
                            fetchedArticles = []
                            tabBarState.forceExpandedBar = false
                        },
                        preserveOrder: true
                    )
                    .ignoresSafeArea()
                    .zIndex(1)
                }

                // Loading overlay while fetching article
                if isLoadingArticle {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                        .overlay {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(1.2)
                        }
                        .zIndex(2)
                }
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.large)
            .toolbar(selectedArticle != nil ? .hidden : .visible, for: .navigationBar)
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
            .navigationDestination(isPresented: $showPublisherProfile) {
                if let pubId = selectedPublisherId {
                    let creator = Creator(
                        id: pubId,
                        name: "Loading...",
                        username: "",
                        bio: "",
                        avatarUrl: nil,
                        isVerified: true,
                        followerCount: 0,
                        followingCount: 0,
                        articleCount: 0,
                        category: nil
                    )
                    CreatorProfileView(
                        creator: creator,
                        articles: [],
                        onDismiss: { showPublisherProfile = false },
                        onArticleTap: { article in
                            selectedArticle = article
                            showPublisherProfile = false
                        },
                        publisherId: pubId
                    )
                    .navigationBarHidden(true)
                }
            }
        }
    }

    private func openArticle(_ article: SearchArticle) {
        // Switch to icon tab bar (hide search text field)
        withAnimation(.smooth(duration: 0.3)) {
            tabBarState.forceExpandedBar = true
        }

        // Find the tapped article's position and get all results from that point on
        let allResults = viewModel.articles
        let tappedIndex = allResults.firstIndex(where: { $0.id.stringValue == article.id.stringValue }) ?? 0
        let remainingResults = Array(allResults.suffix(from: tappedIndex))

        Task {
            isLoadingArticle = true

            // Fetch the tapped article first
            do {
                let response = try await articleService.fetchArticle(id: article.id.stringValue)
                withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                    selectedArticle = response.article
                }
            } catch {
                withAnimation(.smooth(duration: 0.3)) {
                    tabBarState.forceExpandedBar = false
                }
                isLoadingArticle = false
                return
            }
            isLoadingArticle = false

            // Fetch remaining search results in background (next articles after the tapped one)
            let otherResults = remainingResults.dropFirst()
            await withTaskGroup(of: (Int, Article?).self) { group in
                for (offset, searchArticle) in otherResults.enumerated() {
                    group.addTask {
                        let resp = try? await articleService.fetchArticle(id: searchArticle.id.stringValue)
                        return (offset, resp?.article)
                    }
                }

                var indexed: [(Int, Article)] = []
                for await (offset, article) in group {
                    if let article { indexed.append((offset, article)) }
                }

                // Sort by original search order and update pager
                let sorted = indexed.sorted { $0.0 < $1.0 }.map(\.1)
                await MainActor.run {
                    fetchedArticles = sorted
                }
            }
        }
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

    // MARK: - Publisher Results

    @ViewBuilder
    private var publisherResults: some View {
        let pubs = viewModel.publishers
        let ents = viewModel.entities
        if pubs.isEmpty && ents.isEmpty {
            VStack(spacing: 16) {
                Spacer().frame(height: 60)
                Image(systemName: "person.2.slash")
                    .font(.system(size: 36))
                    .foregroundStyle(.white.opacity(0.3))
                Text("No profiles found")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.white.opacity(0.5))
                Spacer()
            }
            .frame(maxWidth: .infinity)
        } else {
            LazyVStack(spacing: 12) {
                // Publishers from the publishers table
                ForEach(pubs) { pub in
                    Button {
                        selectedPublisherId = pub.id
                        showPublisherProfile = true
                    } label: {
                        publisherCard(
                            name: pub.displayName,
                            category: pub.category ?? "News",
                            emoji: "📰",
                            articleCount: pub.articleCount ?? 0
                        )
                    }
                    .buttonStyle(.plain)
                }
                // Entities as secondary results
                ForEach(ents) { entity in
                    publisherCard(
                        name: entity.displayTitle,
                        category: entity.category,
                        emoji: entity.emoji,
                        articleCount: entity.articleCount ?? 0
                    )
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func publisherCard(name: String, category: String, emoji: String, articleCount: Int) -> some View {
        HStack(spacing: 14) {
            // Avatar circle
            ZStack {
                Circle()
                    .fill(categoryColor(for: category).opacity(0.2))
                    .frame(width: 50, height: 50)
                Text(String(name.prefix(1)))
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(categoryColor(for: category))
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 4) {
                    Text(name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(.blue)
                }
                Text("\(articleCount) articles · \(category)")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.45))
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white.opacity(0.3))
        }
        .padding(14)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
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
    /// Blur color matching ArticleCardView — keeps the card's glass tint visually
    /// consistent with what the user sees when the article opens.
    @State private var dominantBlurColor: Color?
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

            // Glass layer tinted with the article's dark blur color — identical
            // to what the open article page uses for its background.
            Color.clear
                .frame(width: cardWidth, height: cardHeight)
                .glassEffect(
                    .regular.tint((dominantBlurColor ?? dominantColor ?? fallbackColor).opacity(0.5)),
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

    // MARK: - Color Extraction

    /// Defers to ArticleCardView's shared cache + extractor so this card's
    /// blur tint and highlight color are identical to the open article page.
    private func extractColor(from url: URL, image: UIImage) {
        if let cachedAccent = ArticleCardView.colorCache.object(forKey: url as NSURL),
           let cachedBlur = ArticleCardView.blurColorCache.object(forKey: url as NSURL) {
            dominantColor = Color(cachedAccent)
            dominantBlurColor = Color(cachedBlur)
            return
        }

        Task.detached(priority: .userInitiated) {
            guard let result = await ArticleCardView.extractAndCacheColors(url: url, loadedImage: image) else { return }
            await MainActor.run {
                withAnimation(.easeOut(duration: 0.3)) {
                    dominantColor = Color(result.accent)
                    dominantBlurColor = Color(result.blur)
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
