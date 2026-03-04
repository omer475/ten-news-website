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
        homeCountry: String? = nil,
        followedCountries: [String]? = nil,
        followedTopics: [String]? = nil,
        onboardingCompleted: Bool? = nil
    ) async throws -> PreferencesResponse {
        let body = PreferencesUpdateRequest(
            homeCountry: homeCountry,
            followedCountries: followedCountries,
            followedTopics: followedTopics,
            onboardingCompleted: onboardingCompleted
        )
        return try await client.patch(APIEndpoints.userPreferences, body: body)
    }
}
