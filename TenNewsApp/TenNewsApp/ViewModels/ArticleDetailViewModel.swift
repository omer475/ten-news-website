import SwiftUI

@MainActor @Observable
final class ArticleDetailViewModel {
    var article: Article?
    var isLoading = false
    var errorMessage: String?
    var selectedComponent: String = "details"
    private let articleService = ArticleService()
    private let analytics = AnalyticsService()

    private var engagementTimer: Task<Void, Never>?
    private var viewStartTime: Date?

    var availableComponents: [String] { article?.availableComponents ?? ["details"] }

    func loadArticle(id: String) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        do {
            let response = try await articleService.fetchArticle(id: id)
            article = response.article
            selectedComponent = article?.availableComponents.first ?? "details"
            isLoading = false
            Task {
                try? await analytics.track(
                    event: "article_detail_view",
                    articleId: Int(id)
                )
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func selectComponent(_ component: String) {
        withAnimation(AppAnimations.quickSpring) {
            selectedComponent = component
        }
        HapticManager.selection()
    }

    func toggleBookmark() {
        guard let article else { return }
        BookmarkManager.shared.toggle(article)
        HapticManager.light()
    }

    func isBookmarked(_ articleId: FlexibleID) -> Bool {
        BookmarkManager.shared.isBookmarked(articleId)
    }

    // MARK: - Engagement Tracking

    func startEngagementTracking(articleId: Int) {
        viewStartTime = Date()
        engagementTimer = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 10_000_000_000)
            guard !Task.isCancelled else { return }
            try? await AnalyticsService().track(
                event: "article_engaged",
                articleId: articleId,
                metadata: ["engaged_seconds": "10"]
            )
            _ = self // prevent premature dealloc
        }
    }

    func stopEngagementTracking(articleId: Int) {
        engagementTimer?.cancel()
        engagementTimer = nil

        if let start = viewStartTime {
            let seconds = Int(Date().timeIntervalSince(start))
            if seconds >= 10 {
                Task {
                    try? await analytics.track(
                        event: "article_exit",
                        articleId: articleId,
                        metadata: ["total_active_seconds": String(seconds)]
                    )
                }
            }
        }
        viewStartTime = nil
    }
}
