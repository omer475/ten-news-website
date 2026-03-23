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
    /// Bucket from the feed response — needed so analytics events include bucket
    /// for proper taste vector / tag profile guard logic on the server.
    private var articleBucket: String = "personal"

    var availableComponents: [String] { article?.availableComponents ?? ["details"] }

    func loadArticle(id: String, bucket: String? = nil) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        if let bucket { articleBucket = bucket }
        do {
            let response = try await articleService.fetchArticle(id: id)
            article = response.article
            selectedComponent = article?.availableComponents.first ?? "details"
            isLoading = false
            Task {
                try? await analytics.track(
                    event: "article_detail_view",
                    articleId: Int(id),
                    metadata: ["bucket": articleBucket]
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

    func startEngagementTracking(articleId: Int, bucket: String? = nil) {
        if let bucket { articleBucket = bucket }
        viewStartTime = Date()
        let bucketValue = articleBucket
        engagementTimer = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 10_000_000_000)
            guard !Task.isCancelled else { return }
            try? await AnalyticsService().track(
                event: "article_engaged",
                articleId: articleId,
                metadata: ["engaged_seconds": "10", "bucket": bucketValue]
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
                let bucketValue = articleBucket
                Task {
                    try? await analytics.track(
                        event: "article_exit",
                        articleId: articleId,
                        metadata: ["total_active_seconds": String(seconds), "bucket": bucketValue]
                    )
                }
            }
        }
        viewStartTime = nil
    }
}
