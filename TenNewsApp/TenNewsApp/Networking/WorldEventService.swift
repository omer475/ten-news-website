import Foundation

struct WorldEventService {
    private let client = APIClient.shared

    func fetchWorldEvents() async throws -> WorldEventsResponse {
        try await client.get(APIEndpoints.worldEvents)
    }

    func fetchEventDetail(slug: String) async throws -> WorldEventDetailResponse {
        try await client.get(APIEndpoints.eventDetail(slug: slug))
    }
}
