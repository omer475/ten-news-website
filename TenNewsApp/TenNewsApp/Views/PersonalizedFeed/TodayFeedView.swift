import SwiftUI

/// Scrollable list of FeedArticleCardView cards for today's news
struct TodayFeedView: View {
    @Bindable var viewModel: PersonalizedFeedViewModel

    var body: some View {
        Group {
            if viewModel.isTodayLoading && viewModel.todayArticles.isEmpty {
                loadingState
            } else if let error = viewModel.todayError, viewModel.todayArticles.isEmpty {
                errorState(error)
            } else if viewModel.todayArticles.isEmpty {
                emptyState
            } else {
                articleList
            }
        }
        .task {
            await viewModel.loadTodayFeed()
        }
    }

    // MARK: - Article List

    private var articleList: some View {
        ScrollView {
            LazyVStack(spacing: Theme.Spacing.md) {
                ForEach(Array(viewModel.todayArticles.enumerated()), id: \.element.id) { index, article in
                    FeedArticleCardView(article: article)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                        .animation(AppAnimations.staggered(index: index), value: viewModel.todayArticles.count)
                }

                // Load more trigger
                if viewModel.todayHasMore {
                    ProgressView()
                        .tint(Theme.Colors.accent)
                        .padding()
                        .task {
                            await viewModel.loadMoreToday()
                        }
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.top, Theme.Spacing.sm)
            .padding(.bottom, 100)
        }
    }

    // MARK: - States

    private var loadingState: some View {
        VStack(spacing: 16) {
            Spacer()
            LoadingDotsView()
            Text("Loading today's news...")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
            Spacer()
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.title)
                .foregroundStyle(Theme.Colors.warning)
            Text(message)
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)
            Button("Retry") {
                Task { await viewModel.loadTodayFeed() }
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .padding()
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "newspaper")
                .font(.largeTitle)
                .foregroundStyle(Theme.Colors.tertiaryText)
            Text("No articles yet")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
            Spacer()
        }
    }
}

#Preview {
    TodayFeedView(viewModel: PersonalizedFeedViewModel())
}
