import Foundation

// MARK: - Response Models

struct PublisherProfileResponse: Codable {
    let publisher: Publisher
    let isFollowing: Bool

    enum CodingKeys: String, CodingKey {
        case publisher
        case isFollowing = "is_following"
    }
}

struct Publisher: Codable, Identifiable, Hashable {
    let id: String
    let username: String
    let displayName: String
    let bio: String?
    let avatarUrl: String?
    let coverImageUrl: String?
    let category: String?
    let interestTags: [String]?
    let isVerified: Bool
    let followerCount: Int
    let articleCount: Int

    enum CodingKeys: String, CodingKey {
        case id, username, bio, category
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case coverImageUrl = "cover_image_url"
        case interestTags = "interest_tags"
        case isVerified = "is_verified"
        case followerCount = "follower_count"
        case articleCount = "article_count"
    }

    var displayInitial: String {
        String(displayName.prefix(1)).uppercased()
    }
}

struct PublisherArticlesResponse: Codable {
    let articles: [Article]
    let hasMore: Bool
    let page: Int

    enum CodingKeys: String, CodingKey {
        case articles
        case hasMore = "has_more"
        case page
    }
}

struct FollowResponse: Codable {
    let success: Bool
    let followerCount: Int

    enum CodingKeys: String, CodingKey {
        case success
        case followerCount = "follower_count"
    }
}

struct DiscoverPublishersResponse: Codable {
    let publishers: [DiscoverPublisher]
}

struct DiscoverPublisher: Codable, Identifiable, Hashable {
    let id: String
    let username: String
    let displayName: String
    let bio: String?
    let avatarUrl: String?
    let category: String?
    let interestTags: [String]?
    let isVerified: Bool
    let followerCount: Int
    let articleCount: Int
    let isFollowing: Bool

    enum CodingKeys: String, CodingKey {
        case id, username, bio, category
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case interestTags = "interest_tags"
        case isVerified = "is_verified"
        case followerCount = "follower_count"
        case articleCount = "article_count"
        case isFollowing = "is_following"
    }
}

// MARK: - Service

struct PublisherService {
    private let client = APIClient.shared

    func fetchPublisher(id: String, userId: String? = nil) async throws -> PublisherProfileResponse {
        var endpoint = APIEndpoints.publisher(id: id)
        if let userId {
            endpoint += "?user_id=\(userId)"
        }
        return try await client.get(endpoint)
    }

    func fetchArticles(publisherId: String, page: Int = 0) async throws -> PublisherArticlesResponse {
        return try await client.get(APIEndpoints.publisherArticles(id: publisherId, page: page))
    }

    func follow(publisherId: String, userId: String) async throws -> FollowResponse {
        struct FollowBody: Encodable { let user_id: String }
        return try await client.post(
            APIEndpoints.publisherFollow(id: publisherId),
            body: FollowBody(user_id: userId)
        )
    }

    func unfollow(publisherId: String, userId: String) async throws -> FollowResponse {
        let endpoint = APIEndpoints.publisherFollow(id: publisherId) + "?user_id=\(userId)"
        return try await client.delete(endpoint)
    }

    func discover(category: String? = nil, userId: String? = nil) async throws -> DiscoverPublishersResponse {
        var endpoint = APIEndpoints.discoverPublishers + "?limit=50"
        if let category {
            endpoint += "&category=\(category.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? category)"
        }
        if let userId {
            endpoint += "&user_id=\(userId)"
        }
        return try await client.get(endpoint)
    }
}
