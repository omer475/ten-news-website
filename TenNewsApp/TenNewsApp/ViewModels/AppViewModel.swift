import SwiftUI

@MainActor @Observable
final class AppViewModel {
    var isOnboardingComplete: Bool = false
    var isAuthenticated: Bool = false
    var currentUser: AuthUser?
    var preferences: UserPreferences = .empty

    private let defaults = UserDefaultsManager.shared
    private let keychain = KeychainManager.shared

    func loadState() {
        isOnboardingComplete = defaults.isOnboardingCompleted
        if let prefs = defaults.loadUserPreferences() { preferences = prefs }
        if let user = defaults.loadAuthUser() { currentUser = user; isAuthenticated = true }
        if keychain.accessToken != nil { isAuthenticated = true }
    }

    func completeOnboarding(with prefs: UserPreferences) {
        preferences = prefs
        isOnboardingComplete = true
        defaults.savePreferences(prefs)
        defaults.isOnboardingCompleted = true
    }

    func login(user: AuthUser, session: AuthSession?) {
        currentUser = user
        isAuthenticated = true
        defaults.saveAuthUser(user)
        if let token = session?.accessToken { keychain.accessToken = token }
        if let refresh = session?.refreshToken { keychain.refreshToken = refresh }
    }

    func logout() {
        currentUser = nil
        isAuthenticated = false
        keychain.accessToken = nil
        keychain.refreshToken = nil
    }

    func updatePreferences(_ prefs: UserPreferences) {
        preferences = prefs
        defaults.savePreferences(prefs)
    }
}
