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
        // Audit fix B6 (2026-05-06): drain any pending events first, then
        // fire this one. If THIS post fails, append it to the persistent
        // queue so we don't lose it on app kill / network drop.
        await Self.drainPending(client: client)
        do {
            let _: MessageResponse = try await client.post(APIEndpoints.analyticsTrack, body: body)
        } catch {
            Self.enqueueForRetry(body)
            throw error
        }
    }

    // MARK: - Persistent retry queue (audit fix B6)
    //
    // Lightweight UserDefaults-backed queue. Failed track() calls are
    // appended; the next successful track() drains them in FIFO order.
    // Capped at 200 to bound storage.

    private static let queueKey = "analytics_retry_queue_v1"
    private static let queueMaxLen = 200

    private static func loadQueue() -> [AnalyticsEventFull] {
        guard let data = UserDefaults.standard.data(forKey: queueKey),
              let decoded = try? JSONDecoder().decode([AnalyticsEventFull].self, from: data) else {
            return []
        }
        return decoded
    }

    private static func saveQueue(_ events: [AnalyticsEventFull]) {
        let trimmed = events.suffix(queueMaxLen)
        if let data = try? JSONEncoder().encode(Array(trimmed)) {
            UserDefaults.standard.set(data, forKey: queueKey)
        }
    }

    private static func enqueueForRetry(_ event: AnalyticsEventFull) {
        var q = loadQueue()
        q.append(event)
        saveQueue(q)
    }

    private static func drainPending(client: APIClient) async {
        var q = loadQueue()
        guard !q.isEmpty else { return }
        // Drain up to 20 per drain pass to keep the call fast on the hot path.
        let toSend = Array(q.prefix(20))
        var sentCount = 0
        for event in toSend {
            do {
                let _: MessageResponse = try await client.post(APIEndpoints.analyticsTrack, body: event)
                sentCount += 1
            } catch {
                // Stop draining on first failure — likely still offline.
                break
            }
        }
        if sentCount > 0 {
            q.removeFirst(sentCount)
            saveQueue(q)
        }
    }
}

// Codable (was Encodable) — required for the audit fix B6 retry queue
// to JSON-roundtrip events through UserDefaults.
struct AnalyticsEventFull: Codable {
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
