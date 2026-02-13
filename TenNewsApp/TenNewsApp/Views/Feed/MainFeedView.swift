import SwiftUI

/// Full-screen vertical pager (TikTok-style) that displays articles as swipeable cards.
/// Shows a splash loading state initially, then transitions to the feed.
/// Includes progress dots on the right edge and loads more articles as the user scrolls.
struct MainFeedView: View {
    @State private var viewModel = FeedViewModel()
    @State private var showSplash = true
    @State private var showEvents = false

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

    // MARK: - Feed Content

    private var feedContent: some View {
        VerticalPager(
            currentIndex: $viewModel.currentIndex,
            pages: viewModel.articles
        ) { article in
            ArticleCardView(
                article: article,
                accentColor: viewModel.accentColor(for: article)
            )
        }
        .ignoresSafeArea()
        .onChange(of: viewModel.currentIndex) { _, newIndex in
            viewModel.trackArticleView(at: newIndex)
            // Prefetch when nearing the end
            if newIndex >= viewModel.articles.count - 3 {
                Task { await viewModel.loadMoreIfNeeded() }
            }
        }
        .overlay(alignment: .trailing) {
            // Progress dots on the right edge
            if viewModel.articles.count > 1 {
                ProgressDotsView(
                    total: min(viewModel.articles.count, 10),
                    current: viewModel.currentIndex % 10
                )
                .padding(.trailing, 8)
            }
        }
        .overlay(alignment: .bottom) {
            // "Caught up" indicator when reaching the end
            if viewModel.currentIndex >= viewModel.articles.count - 1 && !viewModel.hasMore {
                CaughtUpView()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .padding(.bottom, 100)
            }
        }
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

#Preview {
    MainFeedView()
}
