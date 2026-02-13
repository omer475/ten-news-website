import SwiftUI

@MainActor @Observable
final class SettingsViewModel {
    var homeCountry: String?
    var followedCountries: Set<String> = []
    var followedTopics: Set<String> = []
    var isLoading = false
    var errorMessage: String?
    var isSaved = false

    private let userService = UserService()
    private let defaults = UserDefaultsManager.shared

    /// Available data
    var availableCountries: [Country] { Countries.all }
    var availableTopics: [Topic] { Topics.all }

    var homeCountryName: String {
        guard let id = homeCountry else { return "Not set" }
        return Countries.find(byId: id)?.name ?? id
    }

    // MARK: - Load

    func loadFromPreferences(_ preferences: UserPreferences) {
        homeCountry = preferences.homeCountry
        followedCountries = Set(preferences.followedCountries)
        followedTopics = Set(preferences.followedTopics)
    }

    // MARK: - Toggle

    func toggleCountry(_ countryId: String) {
        if followedCountries.contains(countryId) {
            // Don't remove the home country
            guard countryId != homeCountry else { return }
            followedCountries.remove(countryId)
        } else {
            followedCountries.insert(countryId)
        }
        HapticManager.light()
    }

    func toggleTopic(_ topicId: String) {
        if followedTopics.contains(topicId) {
            followedTopics.remove(topicId)
        } else {
            followedTopics.insert(topicId)
        }
        HapticManager.light()
    }

    func setHomeCountry(_ countryId: String) {
        homeCountry = countryId
        followedCountries.insert(countryId)
        HapticManager.selection()
    }

    // MARK: - Save

    func save() -> UserPreferences {
        let prefs = UserPreferences(
            homeCountry: homeCountry,
            followedCountries: Array(followedCountries),
            followedTopics: Array(followedTopics),
            onboardingCompleted: true
        )
        defaults.savePreferences(prefs)
        isSaved = true
        HapticManager.success()
        return prefs
    }

    func saveToServer(userId: String?) async {
        isLoading = true
        errorMessage = nil
        do {
            _ = try await userService.updatePreferences(
                homeCountry: homeCountry,
                followedCountries: Array(followedCountries),
                followedTopics: Array(followedTopics)
            )
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}
