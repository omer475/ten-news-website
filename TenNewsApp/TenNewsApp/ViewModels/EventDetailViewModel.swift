import SwiftUI

@MainActor @Observable
final class EventDetailViewModel {
    var eventDetail: WorldEventFull?
    var relatedArticles: [Article] = []
    var isLoading = false
    var errorMessage: String?

    private let service = WorldEventService()

    func loadEvent(slug: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await service.fetchEventDetail(slug: slug)
            eventDetail = response.event
            relatedArticles = response.articles ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
