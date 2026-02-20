import SwiftUI

@MainActor @Observable
final class EventDetailViewModel {
    var eventDetail: WorldEventFull?
    var isLoading = false
    var errorMessage: String?

    private let service = WorldEventService()

    func loadEvent(slug: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await service.fetchEventDetail(slug: slug)
            eventDetail = response.event
        } catch {
            errorMessage = "\(error)"
        }
        isLoading = false
    }
}
