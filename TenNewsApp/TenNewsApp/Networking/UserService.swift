import Foundation

struct UserService {
    private let client = APIClient.shared

    func fetchProfile() async throws -> UserProfileResponse {
        try await client.get(APIEndpoints.userProfile)
    }

    func updateProfile(name: String?, avatarUrl: String?) async throws -> UserProfileResponse {
        let body = UpdateProfileRequest(name: name, avatarUrl: avatarUrl)
        return try await client.patch(APIEndpoints.userProfile, body: body)
    }

    func fetchPreferences() async throws -> PreferencesResponse {
        try await client.get(APIEndpoints.userPreferences)
    }

    func updatePreferences(
        userId: String,
        homeCountry: String? = nil,
        followedCountries: [String]? = nil,
        followedTopics: [String]? = nil,
        onboardingCompleted: Bool? = nil
    ) async throws -> PreferencesResponse {
        let body = PreferencesUpdateRequest(
            authUserId: userId,
            homeCountry: homeCountry,
            followedCountries: followedCountries,
            followedTopics: followedTopics,
            onboardingCompleted: onboardingCompleted
        )
        return try await client.patch(APIEndpoints.userPreferences, body: body)
    }

    // MARK: - Social graph (user → user follows)
    //
    // Backs the Followers / Following surfaces on the Account tab and the
    // UserProfileView. Distinct from publisher follows (PublisherService),
    // which power the per-creator follow chip and the Following-publishers
    // list.

    func followUser(targetId: String, followerId: String) async throws -> SocialFollowMutationResponse {
        let body = SocialFollowBody(user_id: followerId)
        return try await client.post(APIEndpoints.userFollowAction(id: targetId), body: body)
    }

    func unfollowUser(targetId: String, followerId: String) async throws -> SocialFollowMutationResponse {
        return try await client.delete(
            APIEndpoints.userFollowAction(id: targetId) + "?user_id=\(followerId)"
        )
    }

    func fetchUserFollowers(userId: String, limit: Int = 50, offset: Int = 0) async throws -> SocialListResponse {
        return try await client.get(APIEndpoints.userFollowers(id: userId, limit: limit, offset: offset))
    }

    func fetchUserFollowing(userId: String, limit: Int = 50, offset: Int = 0) async throws -> SocialListResponse {
        return try await client.get(APIEndpoints.userFollowing(id: userId, limit: limit, offset: offset))
    }

    func fetchUserProfile(userId: String, viewerId: String? = nil) async throws -> UserProfileLookupResponse {
        return try await client.get(APIEndpoints.userProfileLookup(id: userId, viewerId: viewerId))
    }

    func searchUsers(query: String, excludeId: String? = nil) async throws -> SocialUserSearchResponse {
        return try await client.get(APIEndpoints.userSearch(query: query, excludeId: excludeId))
    }
}

// MARK: - Social-graph DTOs

struct SocialProfile: Codable, Identifiable, Hashable {
    let id: String
    let username: String?
    let displayName: String?
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, username
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
    }

    var renderedName: String {
        if let display = displayName?.trimmingCharacters(in: .whitespaces), !display.isEmpty {
            return display
        }
        if let u = username?.trimmingCharacters(in: .whitespaces), !u.isEmpty {
            return u
        }
        return "User"
    }
}

struct SocialListResponse: Codable {
    let users: [SocialProfile]
    let count: Int
}

struct SocialFollowMutationResponse: Codable {
    let success: Bool
    let followerCount: Int

    enum CodingKeys: String, CodingKey {
        case success
        case followerCount = "follower_count"
    }
}

struct UserProfileLookupResponse: Codable {
    let profile: SocialProfile
    let followerCount: Int
    let followingCount: Int
    let isFollowing: Bool?

    enum CodingKeys: String, CodingKey {
        case profile
        case followerCount = "follower_count"
        case followingCount = "following_count"
        case isFollowing = "is_following"
    }
}

struct SocialUserSearchResponse: Codable {
    let users: [SocialProfile]
}

private struct SocialFollowBody: Encodable {
    let user_id: String
}
