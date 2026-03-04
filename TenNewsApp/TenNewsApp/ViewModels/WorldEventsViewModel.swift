import SwiftUI

@MainActor @Observable
final class WorldEventsViewModel {
    var events: [WorldEvent] = []
    var selectedEvent: WorldEventFull?
    var isLoading = false
    var errorMessage: String?

    private let eventService = WorldEventService()

    func loadEvents() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        do {
            let response = try await eventService.fetchWorldEvents()
            events = response.events
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func loadEventDetail(slug: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await eventService.fetchEventDetail(slug: slug)
            selectedEvent = response.event
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}
