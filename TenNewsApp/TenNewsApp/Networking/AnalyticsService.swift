import Foundation

struct AnalyticsService {
    private let client = APIClient.shared

    func track(
        event: String,
        properties: [String: String]? = nil,
        userId: String? = nil
    ) async throws {
        let body = AnalyticsEvent(
            event: event,
            properties: properties,
            userId: userId,
            timestamp: ISO8601DateFormatter().string(from: Date())
        )
        let _: MessageResponse = try await client.post(APIEndpoints.analyticsTrack, body: body)
    }
}
