import SwiftUI

@MainActor @Observable
final class SettingsViewModel {
    var homeCountry: String?
    var followedCountries: Set<String> = []
    var followedTopics: Set<String> = []
    var isLoading = false
    var errorMessage: String?
    var isSaved = false

    // MARK: - Local Preferences

    var notificationsEnabled: Bool = true {
        didSet { UserDefaults.standard.set(notificationsEnabled, forKey: "settings_notifications_enabled") }
    }
    var breakingNewsAlerts: Bool = true {
        didSet { UserDefaults.standard.set(breakingNewsAlerts, forKey: "settings_breaking_news") }
    }
    var eventUpdateAlerts: Bool = true {
        didSet { UserDefaults.standard.set(eventUpdateAlerts, forKey: "settings_event_updates") }
    }
    var dailyBriefingEnabled: Bool = false {
        didSet { UserDefaults.standard.set(dailyBriefingEnabled, forKey: "settings_daily_briefing") }
    }
    var textSizePreference: String = "medium" {
        didSet { UserDefaults.standard.set(textSizePreference, forKey: "settings_text_size") }
    }
    var hapticFeedbackEnabled: Bool = true {
        didSet { UserDefaults.standard.set(hapticFeedbackEnabled, forKey: "settings_haptic_feedback") }
    }
    var appearanceMode: String = "dark" {
        didSet { UserDefaults.standard.set(appearanceMode, forKey: "settings_appearance_mode") }
    }

    // MARK: - Expand/Collapse State

    var homeCountryExpanded = false
    var followedCountriesExpanded = false
    var followedTopicsExpanded = false

    private let userService = UserService()
    private let defaults = UserDefaultsManager.shared

    /// Available data
    var availableCountries: [Country] { Countries.all }
    var availableTopics: [Topic] { Topics.all }

    var homeCountryName: String {
        guard let id = homeCountry else { return "Not set" }
        return Countries.find(byId: id)?.name ?? id
    }

    // MARK: - Computed Data Counts

    var readingHistoryCount: Int {
        ReadingHistoryManager.shared.entries.count
    }

    var bookmarkCount: Int {
        BookmarkManager.shared.savedArticles.count
    }

    var cacheSize: String {
        let bytes = URLCache.shared.currentDiskUsage + URLCache.shared.currentMemoryUsage
        if bytes < 1_000_000 {
            return "\(bytes / 1_000) KB"
        } else {
            return String(format: "%.1f MB", Double(bytes) / 1_000_000)
        }
    }

    // MARK: - Load

    func loadFromPreferences(_ preferences: UserPreferences) {
        homeCountry = preferences.homeCountry
        followedCountries = Set(preferences.followedCountries)
        followedTopics = Set(preferences.followedTopics)
        loadLocalPreferences()
    }

    private func loadLocalPreferences() {
        let ud = UserDefaults.standard
        // Use registered defaults pattern: only read if key exists
        if ud.object(forKey: "settings_notifications_enabled") != nil {
            notificationsEnabled = ud.bool(forKey: "settings_notifications_enabled")
        }
        if ud.object(forKey: "settings_breaking_news") != nil {
            breakingNewsAlerts = ud.bool(forKey: "settings_breaking_news")
        }
        if ud.object(forKey: "settings_event_updates") != nil {
            eventUpdateAlerts = ud.bool(forKey: "settings_event_updates")
        }
        if ud.object(forKey: "settings_daily_briefing") != nil {
            dailyBriefingEnabled = ud.bool(forKey: "settings_daily_briefing")
        }
        if let size = ud.string(forKey: "settings_text_size") {
            textSizePreference = size
        }
        if ud.object(forKey: "settings_haptic_feedback") != nil {
            hapticFeedbackEnabled = ud.bool(forKey: "settings_haptic_feedback")
        }
        if let mode = ud.string(forKey: "settings_appearance_mode") {
            appearanceMode = mode
        }
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

    // MARK: - Data Management

    func clearReadingHistory() {
        ReadingHistoryManager.shared.clearHistory()
        HapticManager.success()
    }

    func clearBookmarks() {
        BookmarkManager.shared.clearAll()
        HapticManager.success()
    }

    func clearCache() {
        URLCache.shared.removeAllCachedResponses()
        HapticManager.success()
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
                userId: userId ?? "",
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
