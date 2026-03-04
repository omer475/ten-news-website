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
            if let event = response.event {
                eventDetail = event
            } else {
                errorMessage = response.error ?? "Event not found"
            }
        } catch let decodingError as DecodingError {
            switch decodingError {
            case .typeMismatch(let type, let ctx):
                errorMessage = "Type mismatch: expected \(type) at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))"
                print("🔴 DECODING ERROR: typeMismatch - expected \(type) at \(ctx.codingPath.map(\.stringValue).joined(separator: ".")) — \(ctx.debugDescription)")
            case .valueNotFound(let type, let ctx):
                errorMessage = "Value not found: \(type) at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))"
                print("🔴 DECODING ERROR: valueNotFound - \(type) at \(ctx.codingPath.map(\.stringValue).joined(separator: ".")) — \(ctx.debugDescription)")
            case .keyNotFound(let key, let ctx):
                errorMessage = "Key not found: \(key.stringValue) at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))"
                print("🔴 DECODING ERROR: keyNotFound - \(key.stringValue) at \(ctx.codingPath.map(\.stringValue).joined(separator: ".")) — \(ctx.debugDescription)")
            case .dataCorrupted(let ctx):
                errorMessage = "Data corrupted at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))"
                print("🔴 DECODING ERROR: dataCorrupted at \(ctx.codingPath.map(\.stringValue).joined(separator: ".")) — \(ctx.debugDescription)")
            @unknown default:
                errorMessage = "\(decodingError)"
            }
        } catch {
            errorMessage = "\(error)"
            print("🔴 EVENT LOAD ERROR: \(error)")
        }
        isLoading = false
    }
}
