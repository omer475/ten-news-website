import Foundation

// MARK: - User Preferences

struct UserPreferences: Codable, Hashable {
    var homeCountry: String?
    var followedCountries: [String]
    var followedTopics: [String]
    var onboardingCompleted: Bool
    var authUserId: String?

    enum CodingKeys: String, CodingKey {
        case homeCountry = "home_country"
        case followedCountries = "followed_countries"
        case followedTopics = "followed_topics"
        case onboardingCompleted = "onboarding_completed"
        case authUserId = "auth_user_id"
    }

    init(homeCountry: String? = nil,
         followedCountries: [String] = [],
         followedTopics: [String] = [],
         onboardingCompleted: Bool = false,
         authUserId: String? = nil) {
        self.homeCountry = homeCountry
        self.followedCountries = followedCountries
        self.followedTopics = followedTopics
        self.onboardingCompleted = onboardingCompleted
        self.authUserId = authUserId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        homeCountry = try container.decodeIfPresent(String.self, forKey: .homeCountry)
        followedCountries = try container.decodeIfPresent([String].self, forKey: .followedCountries) ?? []
        followedTopics = try container.decodeIfPresent([String].self, forKey: .followedTopics) ?? []
        onboardingCompleted = try container.decodeIfPresent(Bool.self, forKey: .onboardingCompleted) ?? false
        authUserId = try container.decodeIfPresent(String.self, forKey: .authUserId)
    }
}

// MARK: - Preferences Update Request

extension UserPreferences {
    static let empty = UserPreferences()
}

struct PreferencesUpdateRequest: Codable {
    let homeCountry: String?
    let followedCountries: [String]?
    let followedTopics: [String]?
    let onboardingCompleted: Bool?

    enum CodingKeys: String, CodingKey {
        case homeCountry = "home_country"
        case followedCountries = "followed_countries"
        case followedTopics = "followed_topics"
        case onboardingCompleted = "onboarding_completed"
    }
}

// MARK: - Preferences Response

struct PreferencesResponse: Codable {
    let success: Bool?
    let preferences: UserPreferences?
    let message: String?
}
