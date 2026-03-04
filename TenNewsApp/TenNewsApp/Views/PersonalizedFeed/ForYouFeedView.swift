import SwiftUI

/// Scrollable list of FeedArticleCardView cards for personalized feed with match tags
struct ForYouFeedView: View {
    @Bindable var viewModel: PersonalizedFeedViewModel
    var preferences: UserPreferences
    var userId: String?

    var body: some View {
        Group {
            if viewModel.isForYouLoading && viewModel.forYouArticles.isEmpty {
                loadingState
            } else if let error = viewModel.forYouError, viewModel.forYouArticles.isEmpty {
                errorState(error)
            } else if viewModel.forYouArticles.isEmpty {
                emptyState
            } else {
                articleList
            }
        }
        .task {
            await viewModel.loadForYouFeed(preferences: preferences, userId: userId)
        }
    }

    // MARK: - Article List

    private var articleList: some View {
        ScrollView {
            LazyVStack(spacing: Theme.Spacing.md) {
                ForEach(Array(viewModel.forYouArticles.enumerated()), id: \.element.id) { index, article in
                    FeedArticleCardView(article: article, showMatchTags: true, preferences: preferences)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                        .animation(AppAnimations.staggered(index: index), value: viewModel.forYouArticles.count)
                }

                // Load more trigger
                if viewModel.forYouHasMore {
                    ProgressView()
                        .tint(Theme.Colors.accent)
                        .padding()
                        .task {
                            await viewModel.loadMoreForYou(preferences: preferences, userId: userId)
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
            Text("Building your personalized feed...")
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
                Task {
                    await viewModel.loadForYouFeed(preferences: preferences, userId: userId)
                }
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .padding()
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "sparkles")
                .font(.largeTitle)
                .foregroundStyle(Theme.Colors.tertiaryText)
            Text("Complete onboarding to see personalized articles")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)
            Spacer()
        }
    }
}

#Preview {
    ForYouFeedView(
        viewModel: PersonalizedFeedViewModel(),
        preferences: PreviewData.samplePreferences
    )
}
