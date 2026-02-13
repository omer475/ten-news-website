import SwiftUI

@MainActor @Observable
final class PersonalizedFeedViewModel {
    enum FeedTab: String, CaseIterable {
        case today = "Today"
        case forYou = "For You"
    }

    var todayArticles: [Article] = []
    var forYouArticles: [Article] = []
    var selectedTab: FeedTab = .today
    var isTodayLoading = false
    var isForYouLoading = false
    var todayError: String?
    var forYouError: String?
    var todayHasMore = true
    var forYouHasMore = true

    private var todayPage = 1
    private var forYouOffset = 0

    private let feedService = FeedService()

    var isLoading: Bool { isTodayLoading || isForYouLoading }

    func loadTodayFeed() async {
        guard !isTodayLoading else { return }
        isTodayLoading = true
        todayError = nil
        todayPage = 1
        do {
            let response = try await feedService.fetchTodayFeed(page: 1, pageSize: 15)
            todayArticles = response.articles
            todayHasMore = !response.articles.isEmpty
            isTodayLoading = false
        } catch {
            todayError = error.localizedDescription
            isTodayLoading = false
        }
    }

    func loadMoreToday() async {
        guard todayHasMore, !isTodayLoading else { return }
        isTodayLoading = true
        todayPage += 1
        do {
            let response = try await feedService.fetchTodayFeed(page: todayPage, pageSize: 15)
            todayArticles.append(contentsOf: response.articles)
            todayHasMore = !response.articles.isEmpty
            isTodayLoading = false
        } catch {
            isTodayLoading = false
        }
    }

    func loadForYouFeed(preferences: UserPreferences, userId: String?) async {
        guard !isForYouLoading else { return }
        isForYouLoading = true
        forYouError = nil
        forYouOffset = 0
        do {
            let response = try await feedService.fetchForYouFeed(
                homeCountry: preferences.homeCountry ?? "US",
                followedCountries: preferences.followedCountries,
                followedTopics: preferences.followedTopics,
                userId: userId,
                limit: 20,
                offset: 0
            )
            forYouArticles = response.articles
            forYouHasMore = response.hasMore
            forYouOffset = response.articles.count
            isForYouLoading = false
        } catch {
            forYouError = error.localizedDescription
            isForYouLoading = false
        }
    }

    func loadMoreForYou(preferences: UserPreferences, userId: String?) async {
        guard forYouHasMore, !isForYouLoading else { return }
        isForYouLoading = true
        do {
            let response = try await feedService.fetchForYouFeed(
                homeCountry: preferences.homeCountry ?? "US",
                followedCountries: preferences.followedCountries,
                followedTopics: preferences.followedTopics,
                userId: userId,
                limit: 20,
                offset: forYouOffset
            )
            forYouArticles.append(contentsOf: response.articles)
            forYouHasMore = response.hasMore
            forYouOffset += response.articles.count
            isForYouLoading = false
        } catch {
            isForYouLoading = false
        }
    }

    func refreshAll(preferences: UserPreferences, userId: String?) async {
        todayArticles = []
        forYouArticles = []
        async let today: () = loadTodayFeed()
        async let forYou: () = loadForYouFeed(preferences: preferences, userId: userId)
        _ = await (today, forYou)
    }
}
