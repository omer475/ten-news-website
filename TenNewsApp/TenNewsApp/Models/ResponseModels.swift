import Foundation

// MARK: - Article Detail Response

struct ArticleDetailResponse: Codable {
    let article: Article
}

// MARK: - World Event Detail Response
/// Response for /api/world-events/:slug endpoint

struct WorldEventDetailResponse: Codable {
    let event: WorldEventFull
    let articles: [Article]?
}

// MARK: - Auth Response

struct AuthResponse: Codable {
    let user: AuthUser?
    let session: AuthSession?
    let accessToken: String?
    let refreshToken: String?
    let message: String?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case user, session, message, error
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }
}

// MARK: - Generic Message Response

struct MessageResponse: Codable {
    let success: Bool?
    let message: String?
    let error: String?
}

// MARK: - Profile Update Request

struct UpdateProfileRequest: Encodable {
    let name: String?
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case name
        case avatarUrl = "avatar_url"
    }
}

// MARK: - User Profile Response

struct UserProfileResponse: Codable {
    let user: AuthUser?
    let preferences: UserPreferences?
}

// MARK: - Preferences Update Request (used by UserService)

struct UpdatePreferencesRequest: Encodable {
    let homeCountry: String?
    let followedCountries: [String]?
    let followedTopics: [String]?
    let notificationsEnabled: Bool?

    enum CodingKeys: String, CodingKey {
        case homeCountry = "home_country"
        case followedCountries = "followed_countries"
        case followedTopics = "followed_topics"
        case notificationsEnabled = "notifications_enabled"
    }
}

// MARK: - Analytics Event

struct AnalyticsEvent: Encodable {
    let event: String
    let properties: [String: String]?
    let userId: String?
    let timestamp: String?

    enum CodingKeys: String, CodingKey {
        case event, properties, timestamp
        case userId = "user_id"
    }
}
