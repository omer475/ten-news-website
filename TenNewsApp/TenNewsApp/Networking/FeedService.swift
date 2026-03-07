import Foundation

struct FeedService {
    private let client = APIClient.shared

    func fetchTodayFeed(page: Int = 1, pageSize: Int = 15) async throws -> NewsFeedResponse {
        try await client.get("\(APIEndpoints.newsFeed)?page=\(page)&pageSize=\(pageSize)")
    }

    func fetchMainFeed(
        cursor: String? = nil,
        limit: Int = 20,
        preferences: UserPreferences? = nil,
        userId: String? = nil,
        engagedIds: [String] = [],
        skippedIds: [String] = []
    ) async throws -> MainFeedResponse {
        var params = "?limit=\(limit)"
        if let cursor { params += "&cursor=\(cursor)" }
        if let uid = userId {
            params += "&user_id=\(uid)"
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
        // Session signals for server-side next-page personalization
        if !engagedIds.isEmpty {
            params += "&engaged_ids=\(engagedIds.joined(separator: ","))"
        }
        if !skippedIds.isEmpty {
            params += "&skipped_ids=\(skippedIds.joined(separator: ","))"
        }
        return try await client.get("\(APIEndpoints.mainFeed)\(params)")
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
