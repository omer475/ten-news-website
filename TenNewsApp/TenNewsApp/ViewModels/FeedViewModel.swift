import SwiftUI

@MainActor @Observable
final class FeedViewModel {
    var articles: [Article] = []
    var worldEvents: [WorldEvent] = []
    var currentIndex: Int = 0
    var isLoading = false
    var errorMessage: String?
    var hasMore = true
    private var currentPage = 1

    private let feedService = FeedService()
    private let eventService = WorldEventService()
    private let analytics = AnalyticsService()

    func loadInitialData() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        do {
            async let feedTask = feedService.fetchTodayFeed(page: 1, pageSize: 15)
            async let eventsTask = eventService.fetchWorldEvents()
            let (feedResponse, eventsResponse) = try await (feedTask, eventsTask)
            articles = feedResponse.articles
            worldEvents = eventsResponse.events
            currentPage = 1
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func loadMoreIfNeeded() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        currentPage += 1
        do {
            let response = try await feedService.fetchTodayFeed(page: currentPage, pageSize: 15)
            articles.append(contentsOf: response.articles)
            hasMore = !response.articles.isEmpty
            isLoading = false
        } catch {
            isLoading = false
        }
    }

    func trackArticleView(at index: Int) {
        guard index < articles.count else { return }
        let article = articles[index]
        Task {
            try? await analytics.track(
                event: "article_view",
                properties: [
                    "article_id": article.id.stringValue,
                    "index": String(index)
                ]
            )
        }
    }

    /// Color for article based on category
    func accentColor(for article: Article) -> Color {
        let categoryColors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
            "Climate": "#339966", "Economy": "#228866"
        ]
        let hex = categoryColors[article.category ?? ""] ?? "#3366CC"
        return Color(hex: hex)
    }
}
