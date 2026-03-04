import SwiftUI

struct PersonalizedFeedView: View {
    let appViewModel: AppViewModel

    @State private var viewModel = PersonalizedFeedViewModel()
    @State private var selectedTabIndex = 0

    private var tabs: [String] { PersonalizedFeedViewModel.FeedTab.allCases.map(\.rawValue) }

    var body: some View {
        VStack(spacing: 0) {
            // Tab switcher
            GlassTabBar(tabs: tabs, selectedTab: $selectedTabIndex)
                .padding(.top, 8)
                .onChange(of: selectedTabIndex) { _, newValue in
                    viewModel.selectedTab = PersonalizedFeedViewModel.FeedTab.allCases[newValue]
                }

            // Feed content
            TabView(selection: $selectedTabIndex) {
                todayFeed
                    .tag(0)
                forYouFeed
                    .tag(1)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .task {
            await viewModel.loadTodayFeed()
        }
    }

    private var todayFeed: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(viewModel.todayArticles) { article in
                    PersonalizedArticleRow(article: article)
                }
                if viewModel.isTodayLoading {
                    LoadingDotsView()
                        .padding()
                }
            }
            .padding(Theme.Spacing.md)
        }
        .refreshable {
            await viewModel.loadTodayFeed()
        }
    }

    private var forYouFeed: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(viewModel.forYouArticles) { article in
                    PersonalizedArticleRow(article: article)
                }
                if viewModel.isForYouLoading {
                    LoadingDotsView()
                        .padding()
                }
            }
            .padding(Theme.Spacing.md)
        }
        .task {
            if viewModel.forYouArticles.isEmpty {
                await viewModel.loadForYouFeed(
                    preferences: appViewModel.preferences,
                    userId: appViewModel.currentUser?.id
                )
            }
        }
        .refreshable {
            await viewModel.loadForYouFeed(
                preferences: appViewModel.preferences,
                userId: appViewModel.currentUser?.id
            )
        }
    }
}

#Preview {
    PersonalizedFeedView(appViewModel: AppViewModel())
}
