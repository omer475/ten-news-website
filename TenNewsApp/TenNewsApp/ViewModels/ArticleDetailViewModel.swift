import SwiftUI

@MainActor @Observable
final class ArticleDetailViewModel {
    var article: Article?
    var isLoading = false
    var errorMessage: String?
    var selectedComponent: String = "details"
    var isBookmarked = false

    private let articleService = ArticleService()
    private let analytics = AnalyticsService()

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
                    properties: ["article_id": id]
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
        isBookmarked.toggle()
        HapticManager.light()
    }
}
