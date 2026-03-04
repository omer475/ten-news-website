import Foundation

final class UserDefaultsManager: @unchecked Sendable {
    static let shared = UserDefaultsManager()

    private let defaults = UserDefaults.standard

    private enum Keys {
        static let hasCompletedOnboarding = "has_completed_onboarding"
        static let homeCountry = "home_country"
        static let followedCountries = "followed_countries"
        static let followedTopics = "followed_topics"
        static let notificationsEnabled = "notifications_enabled"
        static let userId = "user_id"
        static let authUserId = "auth_user_id"
        static let lastVisitDate = "last_visit_date"
        static let userProfileData = "user_profile_data"
    }

    private init() {}

    // MARK: - Onboarding

    var hasCompletedOnboarding: Bool {
        get { defaults.bool(forKey: Keys.hasCompletedOnboarding) }
        set { defaults.set(newValue, forKey: Keys.hasCompletedOnboarding) }
    }

    /// Alias used by AppViewModel
    var isOnboardingCompleted: Bool {
        get { hasCompletedOnboarding }
        set { hasCompletedOnboarding = newValue }
    }

    // MARK: - User Identity

    var userId: String? {
        get { defaults.string(forKey: Keys.userId) }
        set { defaults.set(newValue, forKey: Keys.userId) }
    }

    var authUserId: String? {
        get { defaults.string(forKey: Keys.authUserId) }
        set { defaults.set(newValue, forKey: Keys.authUserId) }
    }

    // MARK: - Last Visit

    var lastVisitDate: Date? {
        get { defaults.object(forKey: Keys.lastVisitDate) as? Date }
        set { defaults.set(newValue, forKey: Keys.lastVisitDate) }
    }

    // MARK: - Preferences

    func savePreferences(
        homeCountry: String?,
        followedCountries: [String],
        followedTopics: [String],
        notificationsEnabled: Bool
    ) {
        defaults.set(homeCountry, forKey: Keys.homeCountry)
        defaults.set(followedCountries, forKey: Keys.followedCountries)
        defaults.set(followedTopics, forKey: Keys.followedTopics)
        defaults.set(notificationsEnabled, forKey: Keys.notificationsEnabled)
    }

    func loadPreferences() -> (
        homeCountry: String?,
        followedCountries: [String],
        followedTopics: [String],
        notificationsEnabled: Bool
    ) {
        let homeCountry = defaults.string(forKey: Keys.homeCountry)
        let followedCountries = defaults.stringArray(forKey: Keys.followedCountries) ?? []
        let followedTopics = defaults.stringArray(forKey: Keys.followedTopics) ?? []
        let notificationsEnabled = defaults.bool(forKey: Keys.notificationsEnabled)
        return (homeCountry, followedCountries, followedTopics, notificationsEnabled)
    }

    // MARK: - User Profile

    func saveUser(_ profile: UserProfile) {
        if let data = try? JSONEncoder().encode(profile) {
            defaults.set(data, forKey: Keys.userProfileData)
        }
    }

    func loadUser() -> UserProfile? {
        guard let data = defaults.data(forKey: Keys.userProfileData) else { return nil }
        return try? JSONDecoder().decode(UserProfile.self, from: data)
    }

    // MARK: - Convenience: Save/Load UserPreferences struct

    func savePreferences(_ prefs: UserPreferences) {
        savePreferences(
            homeCountry: prefs.homeCountry,
            followedCountries: prefs.followedCountries,
            followedTopics: prefs.followedTopics,
            notificationsEnabled: false
        )
        hasCompletedOnboarding = prefs.onboardingCompleted
    }

    func loadUserPreferences() -> UserPreferences? {
        let loaded = loadPreferences()
        guard loaded.homeCountry != nil || !loaded.followedCountries.isEmpty || !loaded.followedTopics.isEmpty else {
            return nil
        }
        return UserPreferences(
            homeCountry: loaded.homeCountry,
            followedCountries: loaded.followedCountries,
            followedTopics: loaded.followedTopics,
            onboardingCompleted: hasCompletedOnboarding
        )
    }

    // MARK: - Convenience: Save/Load AuthUser

    func saveAuthUser(_ user: AuthUser) {
        let profile = UserProfile(
            id: user.id,
            email: user.email ?? "",
            name: user.name,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt
        )
        saveUser(profile)
    }

    func loadAuthUser() -> AuthUser? {
        guard let profile = loadUser(), let id = profile.id else { return nil }
        return AuthUser(
            id: id,
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            createdAt: profile.createdAt
        )
    }

    // MARK: - Clear All

    func clearAll() {
        let allKeys = [
            Keys.hasCompletedOnboarding,
            Keys.homeCountry,
            Keys.followedCountries,
            Keys.followedTopics,
            Keys.notificationsEnabled,
            Keys.userId,
            Keys.authUserId,
            Keys.lastVisitDate,
            Keys.userProfileData
        ]
        allKeys.forEach { defaults.removeObject(forKey: $0) }
    }
}
