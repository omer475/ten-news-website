import SwiftUI

/// Full-screen vertical pager (TikTok-style) with swipeable article cards.
struct MainFeedView: View {
    @Binding var currentPageIndex: Int
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(FeedViewModel.self) private var viewModel
    @Environment(TabBarState.self) private var tabBarState
    @State private var showFlashBrief = false

    /// Articles in server-provided order (embedding-personalized).
    private var sortedArticles: [Article] {
        viewModel.articles
    }

    var body: some View {
        ZStack {
            if viewModel.isLoading && sortedArticles.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .transition(.opacity)
            } else if let error = viewModel.errorMessage, sortedArticles.isEmpty {
                errorView(error)
                    .transition(.opacity)
            } else if !sortedArticles.isEmpty {
                feedContent
                    .transition(.opacity)
            } else {
                CaughtUpView()
            }
        }
        .animation(AppAnimations.pageTransition, value: viewModel.isLoading)
        .sheet(isPresented: $showFlashBrief) {
            FlashBriefSheet(
                articles: sortedArticles,
                worldEvents: viewModel.worldEvents,
                timeOfDay: timeOfDay,
                onArticleTap: { index in
                    showFlashBrief = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                            viewModel.currentIndex = index
                        }
                    }
                }
            )
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(28)
        }
        .task {
            if viewModel.allArticles.isEmpty {
                await viewModel.loadInitialData(
                    preferences: appViewModel.preferences,
                    userId: appViewModel.currentUser?.id
                )
                // Start dwell timer for the first card
                viewModel.recordViewStart(at: 0)
            }
        }
        .onChange(of: tabBarState.feedRefreshRequested) { _, requested in
            if requested {
                tabBarState.feedRefreshRequested = false
                Task {
                    await viewModel.refresh()
                    viewModel.currentIndex = 0
                    viewModel.recordViewStart(at: 0)
                }
            }
        }
    }

    // MARK: - Feed Content

    private var feedContent: some View {
        @Bindable var vm = viewModel
        return VerticalPager(
            currentIndex: $vm.currentIndex,
            pages: sortedArticles,
            onRefresh: {
                await viewModel.refresh()
                viewModel.currentIndex = 0
                viewModel.recordViewStart(at: 0)
            }
        ) { article in
            ArticleCardView(
                article: article,
                accentColor: viewModel.accentColor(for: article)
            )
        }
        .ignoresSafeArea()
        .onChange(of: viewModel.currentIndex) { oldIndex, newIndex in
            // Record signal for the card we just left — this measures dwell time
            // and sends the appropriate event (article_skipped / article_view / article_engaged)
            if oldIndex != newIndex, oldIndex < sortedArticles.count {
                viewModel.recordSwipeAway(fromIndex: oldIndex)
            }

            // Scroll-back detection: swiping backward = strong positive for the revisited article
            if newIndex < oldIndex {
                viewModel.recordRevisit(at: newIndex)
            }

            currentPageIndex = newIndex
            viewModel.recordViewStart(at: newIndex)
            viewModel.trackArticleView(at: newIndex)  // reading history only, no analytics event
            if newIndex >= sortedArticles.count - 5 {
                Task {
                    await viewModel.loadMoreIfNeeded()
                    // If filters removed everything and server has more, keep fetching
                    if newIndex >= sortedArticles.count - 2 && viewModel.hasMore {
                        await viewModel.loadMoreIfNeeded()
                    }
                }
            }
        }
        .overlay(alignment: .bottom) {
            if viewModel.currentIndex >= sortedArticles.count - 1 && !viewModel.hasMore {
                CompactCaughtUpBanner()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .padding(.bottom, 90)
            }
        }
    }

    private var timeOfDay: TimeOfDay { .current }

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
                Task {
                    await viewModel.loadInitialData(
                        preferences: appViewModel.preferences,
                        userId: appViewModel.currentUser?.id
                    )
                }
            }
            .frame(width: 200)
        }
        .padding(Theme.Spacing.xl)
    }
}

#Preview {
    MainFeedView(currentPageIndex: .constant(0))
        .environment(AppViewModel())
        .environment(FeedViewModel())
}
