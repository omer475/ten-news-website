import SwiftUI

struct ExploreView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var viewModel = ExploreViewModel()
    @State private var appeared = false
    @State private var selectedArticle: Article?
    @State private var followedSlugs: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "followed_event_slugs") ?? [])

    private let timeOfDay = TimeOfDay.current
    private let followKey = "followed_event_slugs"

    private var dateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: Date())
    }

    var body: some View {
        ZStack {
            NavigationStack {
                Group {
                    if viewModel.isLoading && viewModel.allArticles.isEmpty {
                        loadingState
                    } else {
                        mainContent
                    }
                }
                .background(Color(white: 0.06))
                .navigationTitle("Explore")
                .navigationBarTitleDisplayMode(.large)
                .toolbarColorScheme(.dark, for: .navigationBar)
                .navigationDestination(for: WorldEvent.self) { event in
                    EventDetailView(event: event)
                        .environment(\.colorScheme, .light)
                }
                .task {
                    if viewModel.allArticles.isEmpty {
                        await viewModel.loadData(preferences: appViewModel.preferences)
                        withAnimation(.easeOut(duration: 0.4)) { appeared = true }
                    }
                }
                .refreshable {
                    appeared = false
                    await viewModel.refresh(preferences: appViewModel.preferences)
                    withAnimation(.easeOut(duration: 0.4)) { appeared = true }
                }
            }
            .environment(\.colorScheme, .dark)

            // Article sheet overlay — renders above NavigationStack but below tab bar
            if let article = selectedArticle {
                ExploreArticleSheet(
                    selectedArticle: article,
                    allArticles: viewModel.allArticles
                ) {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                        selectedArticle = nil
                    }
                }
                .transition(.move(edge: .bottom))
                .ignoresSafeArea()
                .zIndex(1)
            }
        }
    }

    // MARK: - Loading

    private var loadingState: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(.white.opacity(0.6))
                .scaleEffect(1.2)
            Text("Curating your feed...")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white.opacity(0.3))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Main Content

    private var mainContent: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                // Greeting subheader
                greetingBar
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
                    .sectionAppear(appeared: appeared, index: 0)

                // Spotlight
                if let spotlight = viewModel.spotlightArticle {
                    spotlightSection(spotlight)
                        .sectionAppear(appeared: appeared, index: 1)
                }

                // Live Now
                if !viewModel.liveNowEvents.isEmpty {
                    liveNowSection
                        .padding(.top, 32)
                        .sectionAppear(appeared: appeared, index: 2)
                }

                // Trending Topics
                if !viewModel.trendingTopics.isEmpty {
                    trendingSection
                        .padding(.top, 28)
                        .sectionAppear(appeared: appeared, index: 3)
                }

                // For You
                if !viewModel.forYouPicks.isEmpty {
                    forYouSection
                        .padding(.top, 32)
                        .sectionAppear(appeared: appeared, index: 4)
                }

                // Quick Reads
                if !viewModel.quickReads.isEmpty {
                    quickReadsSection
                        .padding(.top, 32)
                        .sectionAppear(appeared: appeared, index: 5)
                }

                // Around the World
                if !viewModel.aroundTheWorld.isEmpty {
                    aroundTheWorldSection
                        .padding(.top, 32)
                        .sectionAppear(appeared: appeared, index: 6)
                }

                // Deep Dives
                if !viewModel.deepDiveEvents.isEmpty {
                    deepDivesSection
                        .padding(.top, 32)
                        .sectionAppear(appeared: appeared, index: 7)
                }

                // Browse Topics
                if !viewModel.categorySpotlights.isEmpty {
                    browseTopicsSection
                        .padding(.top, 32)
                        .sectionAppear(appeared: appeared, index: 8)
                }

                // Surprise Me
                surpriseMeSection
                    .padding(.top, 32)
                    .sectionAppear(appeared: appeared, index: 9)

                // All Stories — every remaining article
                if !remainingArticles.isEmpty {
                    allStoriesSection
                        .padding(.top, 32)
                        .sectionAppear(appeared: appeared, index: 10)
                }

                // All Events — every remaining event
                if !remainingEvents.isEmpty {
                    allEventsSection
                        .padding(.top, 32)
                        .sectionAppear(appeared: appeared, index: 11)
                }

                Spacer(minLength: 100)
            }
            .padding(.top, 4)
        }
    }

    // MARK: - Greeting Bar

    private var greetingBar: some View {
        HStack(spacing: 10) {
            Image(systemName: timeOfDay.emoji)
                .font(.system(size: 18))
                .foregroundStyle(timeOfDay.accentColor)

            Text(timeOfDay.greeting)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.7))

            Text("·")
                .foregroundStyle(.white.opacity(0.2))

            Text(dateString)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white.opacity(0.35))

            Spacer()
        }
    }

    // MARK: - Spotlight

    private func spotlightSection(_ article: Article) -> some View {
        Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) { selectedArticle = article } } label: {
            ExploreSpotlightCard(article: article)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
    }

    // MARK: - Live Now

    private var liveNowSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(icon: "dot.radiowaves.left.and.right", iconColor: Color(hex: "#ff3b30"), title: "HAPPENING NOW")
                .padding(.horizontal, 20)

            VStack(spacing: 16) {
                ForEach(viewModel.liveNowEvents) { event in
                    NavigationLink(value: event) {
                        ExploreLiveEventCard(event: event)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Trending

    private var trendingSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(icon: "chart.line.uptrend.xyaxis", iconColor: Color(hex: "#FF9500"), title: "TRENDING")
                .padding(.horizontal, 20)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(viewModel.trendingTopics) { topic in
                        trendingPill(topic)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    private func trendingPill(_ topic: ExploreViewModel.TrendingTopic) -> some View {
        HStack(spacing: 7) {
            Circle()
                .fill(topic.color)
                .frame(width: 8, height: 8)
                .shadow(color: topic.color.opacity(0.5), radius: 4)

            Text(topic.name)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)

            Text("\(topic.count)")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(.white.opacity(0.35))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.white.opacity(0.08))
                .clipShape(Capsule())
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(topic.color.opacity(0.08))
        .background(Color(white: 0.11))
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(topic.color.opacity(0.15), lineWidth: 0.5)
        )
    }

    // MARK: - For You

    private var forYouSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .bottom) {
                sectionHeader(icon: "sparkles", iconColor: Color(hex: "#AF52DE"), title: "FOR YOU")
                Spacer()
                Text("Based on your interests")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.25))
                    .padding(.trailing, 20)
            }
            .padding(.leading, 20)

            VStack(spacing: 16) {
                ForEach(viewModel.forYouPicks) { article in
                    Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) { selectedArticle = article } } label: {
                        ExploreSpotlightCard(
                            article: article,
                            badgeLabel: "FOR YOU",
                            badgeIcon: "sparkles",
                            badgeColor: Color(hex: "#AF52DE")
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Quick Reads

    private var quickReadsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(icon: "bolt.fill", iconColor: Color(hex: "#34C759"), title: "QUICK READS")
                .padding(.horizontal, 20)

            VStack(spacing: 16) {
                ForEach(viewModel.quickReads) { article in
                    Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) { selectedArticle = article } } label: {
                        ExploreSpotlightCard(
                            article: article,
                            badgeLabel: "QUICK READ",
                            badgeIcon: "bolt.fill",
                            badgeColor: Color(hex: "#34C759")
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Around the World

    private var aroundTheWorldSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(icon: "globe", iconColor: Color(hex: "#007AFF"), title: "AROUND THE WORLD")
                .padding(.horizontal, 20)

            VStack(spacing: 16) {
                ForEach(viewModel.aroundTheWorld) { cluster in
                    if let first = cluster.articles.first {
                        Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) { selectedArticle = first } } label: {
                            ExploreSpotlightCard(
                                article: first,
                                badgeLabel: "\(cluster.flag) \(cluster.name.uppercased())",
                                badgeIcon: "globe",
                                badgeColor: Color(hex: "#007AFF")
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Deep Dives

    private var deepDivesSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(icon: "arrow.down.doc", iconColor: Color(hex: "#5E5CE6"), title: "DEEP DIVES")
                .padding(.horizontal, 20)

            VStack(spacing: 16) {
                ForEach(viewModel.deepDiveEvents) { event in
                    NavigationLink(value: event) {
                        ExploreLiveEventCard(
                            event: event,
                            badgeLabel: "DEEP DIVE",
                            badgeIcon: "arrow.down.doc",
                            badgeColor: Color(hex: "#5E5CE6")
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Browse Topics

    private var browseTopicsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(icon: "square.grid.2x2", iconColor: Color(hex: "#FF2D55"), title: "BROWSE TOPICS")
                .padding(.horizontal, 20)

            VStack(spacing: 16) {
                ForEach(viewModel.categorySpotlights) { spotlight in
                    if let first = spotlight.articles.first {
                        Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) { selectedArticle = first } } label: {
                            ExploreSpotlightCard(
                                article: first,
                                badgeLabel: spotlight.name.uppercased(),
                                badgeIcon: "square.grid.2x2",
                                badgeColor: spotlight.color
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Surprise Me

    private var surpriseMeSection: some View {
        Group {
            if let random = viewModel.allArticles.randomElement() {
                Button {
                    HapticManager.medium()
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) { selectedArticle = random }
                } label: {
                    surpriseMeButton
                }
                .buttonStyle(.plain)
            } else {
                surpriseMeButton
            }
        }
        .padding(.horizontal, 16)
    }

    private var surpriseMeButton: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(timeOfDay.accentColor.opacity(0.15))
                    .frame(width: 40, height: 40)
                Image(systemName: "dice.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(timeOfDay.accentColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Surprise Me")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                Text("Discover a random story")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.35))
            }

            Spacer()

            Image(systemName: "arrow.right.circle.fill")
                .font(.system(size: 22))
                .foregroundStyle(timeOfDay.accentColor.opacity(0.6))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 18)
                .fill(Color(white: 0.10))
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .stroke(
                            LinearGradient(
                                colors: [timeOfDay.accentColor.opacity(0.3), timeOfDay.accentColor.opacity(0.05)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 0.5
                        )
                )
        )
    }

    // MARK: - Remaining content

    private var featuredArticleIDs: Set<FlexibleID> {
        var ids = Set<FlexibleID>()
        if let s = viewModel.spotlightArticle { ids.insert(s.id) }
        viewModel.forYouPicks.forEach { ids.insert($0.id) }
        viewModel.quickReads.forEach { ids.insert($0.id) }
        viewModel.aroundTheWorld.flatMap(\.articles).forEach { ids.insert($0.id) }
        viewModel.categorySpotlights.flatMap(\.articles).forEach { ids.insert($0.id) }
        return ids
    }

    private var remainingArticles: [Article] {
        let featured = featuredArticleIDs
        return viewModel.allArticles.filter { !featured.contains($0.id) }
    }

    private var featuredEventSlugs: Set<String> {
        var slugs = Set<String>()
        viewModel.liveNowEvents.forEach { slugs.insert($0.slug) }
        viewModel.deepDiveEvents.forEach { slugs.insert($0.slug) }
        return slugs
    }

    private var remainingEvents: [WorldEvent] {
        let featured = featuredEventSlugs
        return viewModel.worldEvents.filter { !featured.contains($0.slug) }
    }

    // MARK: - All Stories

    private var allStoriesSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(icon: "newspaper.fill", iconColor: .white, title: "ALL STORIES")
                .padding(.horizontal, 20)

            VStack(spacing: 16) {
                ForEach(remainingArticles) { article in
                    Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) { selectedArticle = article } } label: {
                        ExploreSpotlightCard(
                            article: article,
                            badgeLabel: (article.category ?? "NEWS").uppercased(),
                            badgeIcon: "newspaper",
                            badgeColor: categoryColor(for: article.category ?? "World")
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - All Events

    private var allEventsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(icon: "globe.americas.fill", iconColor: Color(hex: "#FF9500"), title: "MORE EVENTS")
                .padding(.horizontal, 20)

            VStack(spacing: 16) {
                ForEach(remainingEvents) { event in
                    NavigationLink(value: event) {
                        ExploreLiveEventCard(
                            event: event,
                            badgeLabel: "EVENT",
                            badgeIcon: "globe.americas.fill",
                            badgeColor: Color(hex: "#FF9500")
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Section Header

    private func sectionHeader(icon: String, iconColor: Color, title: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(iconColor)
                .frame(width: 26, height: 26)
                .background(iconColor.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 7))

            Text(title)
                .font(.system(size: 11, weight: .heavy))
                .tracking(1.0)
                .foregroundStyle(.white.opacity(0.45))
        }
    }

    // MARK: - Helpers

    private func categoryColor(for category: String) -> Color {
        let colors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
            "Climate": "#339966", "Economy": "#228866",
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
                    .delay(Double(index) * 0.04),
                value: appeared
            )
    }
}

extension View {
    fileprivate func sectionAppear(appeared: Bool, index: Int) -> some View {
        modifier(SectionAppearModifier(appeared: appeared, index: index))
    }
}
