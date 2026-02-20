import SwiftUI

/// Full-screen vertical pager (TikTok-style) with swipeable article cards.
/// First page shows greeting + world events, then article cards follow.
struct MainFeedView: View {
    @Binding var currentPageIndex: Int
    @State private var viewModel = FeedViewModel()
    @State private var showSplash = true
    @State private var pagerIndex: Int = 0

    var body: some View {
        ZStack {
            if showSplash && viewModel.isLoading && viewModel.articles.isEmpty {
                splashView
                    .transition(.opacity)
            } else if let error = viewModel.errorMessage, viewModel.articles.isEmpty {
                errorView(error)
                    .transition(.opacity)
            } else if !viewModel.articles.isEmpty {
                feedContent
                    .transition(.opacity)
            } else if !viewModel.hasMore && viewModel.articles.isEmpty {
                CaughtUpView()
            }
        }
        .animation(AppAnimations.pageTransition, value: showSplash)
        .task {
            if viewModel.articles.isEmpty {
                await viewModel.loadInitialData()
                withAnimation(AppAnimations.pageTransition) {
                    showSplash = false
                }
            }
        }
    }

    // MARK: - Feed Pages (greeting + articles)

    private var feedPages: [FeedPage] {
        var pages: [FeedPage] = [.greeting]
        pages.append(contentsOf: viewModel.articles.map { .article($0) })
        return pages
    }

    // MARK: - Feed Content

    private var feedContent: some View {
        VerticalPager(
            currentIndex: $pagerIndex,
            pages: feedPages
        ) { page in
            switch page {
            case .greeting:
                greetingPage
            case .article(let article):
                ArticleCardView(
                    article: article,
                    accentColor: viewModel.accentColor(for: article)
                )
            }
        }
        .ignoresSafeArea()
        .onChange(of: pagerIndex) { _, newIndex in
            currentPageIndex = newIndex
            let articleIndex = newIndex - 1
            if articleIndex >= 0 {
                viewModel.currentIndex = articleIndex
                viewModel.trackArticleView(at: articleIndex)
            }
            if articleIndex >= viewModel.articles.count - 3 {
                Task { await viewModel.loadMoreIfNeeded() }
            }
        }
        .overlay(alignment: .bottom) {
            let articleIndex = pagerIndex - 1
            if articleIndex >= viewModel.articles.count - 1 && !viewModel.hasMore {
                CaughtUpView()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .padding(.bottom, 100)
            }
        }
    }

    // MARK: - Swipe Hints

    private static let swipeHints = [
        "Swipe up. The news won't read itself.",
        "Your doom scroll awaits. Swipe up.",
        "Go on, swipe. We both know you're avoiding work.",
        "The world's a mess. Swipe to see why.",
        "Swipe up. Those emails can wait.",
        "The algorithm demands you swipe up.",
        "Breaking: You haven't swiped yet.",
        "Swipe up. Touch grass later.",
        "One does not simply scroll past. Swipe up.",
        "Swipe up. We promise some of it is good news."
    ]

    // MARK: - Greeting Page

    private var greetingPage: some View {
        GeometryReader { geo in
            let cardWidth = geo.size.width - 48

            ZStack {
                Theme.Colors.backgroundPrimary
                    .ignoresSafeArea()

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        // Greeting
                        VStack(alignment: .leading, spacing: 10) {
                            Text(TimeOfDay.current.greeting + ".")
                                .font(.system(size: 42, weight: .bold))
                                .tracking(-1.5)
                                .foregroundStyle(Theme.Colors.primaryText)

                            Text("Here's what's happening in the world.")
                                .font(.system(size: 19, weight: .medium))
                                .foregroundStyle(Color(hex: "#48484a"))
                                .tracking(-0.3)
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, geo.size.height * 0.12)

                        // World Events
                        if !viewModel.worldEvents.isEmpty {
                            VStack(alignment: .leading, spacing: 14) {
                                Text("WORLD EVENTS")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(Color(hex: "#8e8e93"))
                                    .tracking(1.5)
                                    .padding(.horizontal, 24)

                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 14) {
                                        ForEach(viewModel.worldEvents) { event in
                                            NavigationLink(value: event) {
                                                eventCard(event, width: cardWidth)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                    .padding(.horizontal, 24)
                                    .scrollTargetLayout()
                                }
                                .scrollTargetBehavior(.viewAligned)
                            }
                            .padding(.top, 90)
                        }

                        // Swipe hint
                        Text(Self.swipeHints.randomElement() ?? "Swipe up.")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Color(hex: "#8e8e93"))
                            .frame(maxWidth: .infinity)
                            .padding(.top, 32)
                            .padding(.bottom, 50)
                    }
                }
                .scrollDisabled(true)
            }
        }
    }

    private func eventCard(_ event: WorldEvent, width: CGFloat) -> some View {
        let cardHeight = width * 5 / 4

        return ZStack(alignment: .bottom) {
            // Event image — slightly zoomed and cropped from sides/top
            if let imageUrl = event.displayImage {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(width: width + 30, height: cardHeight + 20)
                    .clipped()
                    .offset(y: -10)
            } else {
                Rectangle()
                    .fill(Color(hex: event.blurColor ?? "#1a1a2e").gradient)
            }

            // Gradient fade from clear → glass overlay
            VStack(spacing: 0) {
                Spacer()

                // Gradient blur zone — fades from fully transparent to blurred
                Rectangle()
                    .fill(.regularMaterial)
                    .mask(
                        LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0.0),
                                .init(color: .black.opacity(0.4), location: 0.15),
                                .init(color: .black.opacity(0.75), location: 0.35),
                                .init(color: .black, location: 0.55),
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: cardHeight * 0.6)
            }

            // Content overlay at bottom
            VStack(alignment: .leading, spacing: 8) {
                Text(event.name)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if let bg = event.background, !bg.isEmpty {
                    Text(String(bg.prefix(80)))
                        .font(.system(size: 14))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                // Metadata row
                HStack(spacing: 6) {
                    if let updates = event.newUpdates, updates > 0 {
                        Text("NEW")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(hex: "#ff3b30"), in: Capsule())

                        Text("\(updates) updates")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)

                        Text("•")
                            .foregroundStyle(.tertiary)
                    }

                    if let lastAt = event.lastArticleAt {
                        TimeAgoText(lastAt)
                    }
                }
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 22)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(width: width, height: cardHeight)
        .clipShape(RoundedRectangle(cornerRadius: 28))
        .shadow(color: .black.opacity(0.06), radius: 8, y: 4)
    }

    // MARK: - Splash / Loading

    private var splashView: some View {
        VStack(spacing: 20) {
            Image(systemName: "newspaper.fill")
                .font(.system(size: 56))
                .foregroundStyle(Theme.Colors.accent)
                .symbolEffect(.pulse)

            Text("Ten News")
                .font(.system(size: 32, weight: .bold))
                .foregroundStyle(Theme.Colors.primaryText)

            LoadingDotsView()

            Text("Loading your news...")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
        }
    }

    // MARK: - Error

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Colors.secondaryText)

            Text("Unable to load news")
                .font(Theme.Fonts.title())
                .foregroundStyle(Theme.Colors.primaryText)

            Text(message)
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)

            GlassCTAButton(title: "Try Again") {
                Task { await viewModel.loadInitialData() }
            }
            .frame(width: 200)
        }
        .padding(Theme.Spacing.xl)
    }
}

// MARK: - Feed Page Enum

private enum FeedPage: Identifiable {
    case greeting
    case article(Article)

    var id: String {
        switch self {
        case .greeting: return "__greeting__"
        case .article(let article): return "article-\(article.id)"
        }
    }
}

#Preview {
    MainFeedView(currentPageIndex: .constant(0))
}
