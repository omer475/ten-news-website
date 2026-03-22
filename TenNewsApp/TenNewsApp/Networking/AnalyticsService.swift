import Foundation

struct AnalyticsService {
    private let client = APIClient.shared

    /// Stable device-level guest ID for unauthenticated users.
    private static var guestDeviceId: String {
        let key = "guest_device_id"
        if let existing = UserDefaults.standard.string(forKey: key) { return existing }
        let id = UUID().uuidString
        UserDefaults.standard.set(id, forKey: key)
        return id
    }

    /// Get the current user ID — works for both authenticated and guest users.
    /// Falls back to guest device ID if no auth user is stored.
    private static var currentUserId: String {
        // Try stored auth user ID first
        if let authId = UserDefaults.standard.string(forKey: "auth_user_id"), !authId.isEmpty {
            return authId
        }
        // Try user_id key
        if let userId = UserDefaults.standard.string(forKey: "user_id"), !userId.isEmpty {
            return userId
        }
        // Fall back to guest device ID
        return guestDeviceId
    }

    func track(
        event: String,
        articleId: Int? = nil,
        category: String? = nil,
        source: String? = nil,
        metadata: [String: String]? = nil
    ) async throws {
        let isGuest = KeychainManager.shared.accessToken == nil
        let guestId = isGuest ? Self.guestDeviceId : nil
        // Always send user_id as fallback — handles expired JWT tokens
        let userId = Self.currentUserId

        let body = AnalyticsEventFull(
            eventType: event,
            articleId: articleId,
            sessionId: nil,
            category: category,
            source: source,
            metadata: metadata,
            guestDeviceId: guestId,
            userId: userId
        )
        let _: MessageResponse = try await client.post(APIEndpoints.analyticsTrack, body: body)
    }
}

struct AnalyticsEventFull: Encodable {
    let eventType: String
    let articleId: Int?
    let sessionId: String?
    let category: String?
    let source: String?
    let metadata: [String: String]?
    let guestDeviceId: String?
    let userId: String?

    enum CodingKeys: String, CodingKey {
        case eventType = "event_type"
        case articleId = "article_id"
        case sessionId = "session_id"
        case guestDeviceId = "guest_device_id"
        case userId = "user_id"
        case category, source, metadata
    }
}
