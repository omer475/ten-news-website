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
        // Skip analytics for guest users — backend returns 401 for unauthenticated
        // requests, so these calls are wasted bandwidth. Guest users are identified
        // by having no access token in the keychain.
        guard KeychainManager.shared.accessToken != nil else { return }

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
