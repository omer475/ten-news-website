import Foundation
import os

private let feedLog = Logger(subsystem: "com.tennews.app", category: "FeedAPI")

struct FeedService {
    private let client = APIClient.shared

    func fetchTodayFeed(page: Int = 1, pageSize: Int = 15) async throws -> NewsFeedResponse {
        try await client.get("\(APIEndpoints.newsFeed)?page=\(page)&pageSize=\(pageSize)")
    }

    /// Stable guest device ID for unauthenticated users (matches AnalyticsService)
    private static var guestDeviceId: String {
        let key = "guest_device_id"
        if let existing = UserDefaults.standard.string(forKey: key) { return existing }
        let id = UUID().uuidString
        UserDefaults.standard.set(id, forKey: key)
        return id
    }

    func fetchMainFeed(
        cursor: String? = nil,
        limit: Int = 20,
        preferences: UserPreferences? = nil,
        userId: String? = nil,
        engagedIds: [String] = [],
        glancedIds: [String] = [],
        skippedIds: [String] = [],
        seenIds: [String] = []
    ) async throws -> MainFeedResponse {
        var params = "?limit=\(limit)"
        if let cursor { params += "&cursor=\(cursor)" }
        if let uid = userId {
            params += "&user_id=\(uid)"
        } else {
            // CRITICAL FIX: Send guest_device_id so server can look up taste vector
            params += "&guest_device_id=\(Self.guestDeviceId)"
        }
        if let prefs = preferences {
            if let home = prefs.homeCountry {
                params += "&home_country=\(home)"
            }
            if !prefs.followedCountries.isEmpty {
                params += "&followed_countries=\(prefs.followedCountries.joined(separator: ","))"
            }
            if !prefs.followedTopics.isEmpty {
                params += "&followed_topics=\(prefs.followedTopics.joined(separator: ","))"
            }
        }
        // Session signals for server-side personalization (up to 50 each)
        if !engagedIds.isEmpty {
            params += "&engaged_ids=\(engagedIds.joined(separator: ","))"
        }
        if !glancedIds.isEmpty {
            params += "&glanced_ids=\(glancedIds.joined(separator: ","))"
        }
        if !skippedIds.isEmpty {
            params += "&skipped_ids=\(skippedIds.joined(separator: ","))"
        }
        // Seen IDs for dedup — send last 300 to prevent repeats across pages
        if !seenIds.isEmpty {
            params += "&seen_ids=\(seenIds.suffix(300).joined(separator: ","))"
        }
        let fullURL = "\(APIEndpoints.mainFeed)\(params)"
        feedLog.warning("API CALL: \(fullURL.prefix(200), privacy: .public)")
        let result: MainFeedResponse = try await client.get(fullURL)
        feedLog.warning("API RESULT: \(result.articles.count) articles, hasMore=\(result.hasMore), ids=\(result.articles.prefix(5).map { $0.id.stringValue }.joined(separator: ","), privacy: .public)")
        return result
    }

    func fetchForYouFeed(
        homeCountry: String,
        followedCountries: [String],
        followedTopics: [String],
        userId: String?,
        limit: Int = 20,
        offset: Int = 0
    ) async throws -> ForYouFeedResponse {
        var params = "?home_country=\(homeCountry)&limit=\(limit)&offset=\(offset)"
        if !followedCountries.isEmpty {
            params += "&followed_countries=\(followedCountries.joined(separator: ","))"
        }
        if !followedTopics.isEmpty {
            params += "&followed_topics=\(followedTopics.joined(separator: ","))"
        }
        if let uid = userId {
            params += "&user_id=\(uid)"
        }
        return try await client.get("\(APIEndpoints.forYouFeed)\(params)")
    }
}
