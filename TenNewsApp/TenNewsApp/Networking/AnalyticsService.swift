import Foundation

struct AnalyticsService {
    private let client = APIClient.shared

    func track(
        event: String,
        articleId: Int? = nil,
        category: String? = nil,
        source: String? = nil,
        metadata: [String: String]? = nil
    ) async throws {
        let body = AnalyticsEvent(
            eventType: event,
            articleId: articleId,
            sessionId: nil,
            category: category,
            source: source,
            metadata: metadata
        )
        let _: MessageResponse = try await client.post(APIEndpoints.analyticsTrack, body: body)
    }
}
