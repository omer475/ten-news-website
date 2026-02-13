import Foundation

struct FeedService {
    private let client = APIClient.shared

    func fetchTodayFeed(page: Int = 1, pageSize: Int = 15) async throws -> NewsFeedResponse {
        try await client.get("\(APIEndpoints.newsFeed)?page=\(page)&pageSize=\(pageSize)")
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
