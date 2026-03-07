import SwiftUI

@MainActor @Observable
final class AppViewModel {
    var isOnboardingComplete: Bool = false
    var isAuthenticated: Bool = false
    var isGuest: Bool = false
    var currentUser: AuthUser?
    var preferences: UserPreferences = .empty

    private let defaults = UserDefaultsManager.shared
    private let keychain = KeychainManager.shared

    /// Stable device-level guest ID persisted across launches.
    private static let guestIdKey = "guest_device_id"
    static var guestDeviceId: String {
        if let existing = UserDefaults.standard.string(forKey: guestIdKey) { return existing }
        let id = UUID().uuidString
        UserDefaults.standard.set(id, forKey: guestIdKey)
        return id
    }

    func loadState() {
        isOnboardingComplete = defaults.isOnboardingCompleted
        if let prefs = defaults.loadUserPreferences() { preferences = prefs }
        if let user = defaults.loadAuthUser() {
            currentUser = user
            isGuest = UserDefaults.standard.bool(forKey: "is_guest_user")
            isAuthenticated = !isGuest
        }
        if keychain.accessToken != nil { isAuthenticated = true; isGuest = false }
    }

    func completeOnboarding(with prefs: UserPreferences) {
        preferences = prefs
        isOnboardingComplete = true
        defaults.savePreferences(prefs)
        defaults.isOnboardingCompleted = true
    }

    func continueAsGuest(with prefs: UserPreferences? = nil) {
        let guestId = Self.guestDeviceId
        let guestUser = AuthUser(
            id: guestId,
            email: nil,
            name: "Guest",
            avatarUrl: nil,
            createdAt: nil
        )
        currentUser = guestUser
        isGuest = true
        isAuthenticated = false
        defaults.saveAuthUser(guestUser)
        UserDefaults.standard.set(true, forKey: "is_guest_user")
        completeOnboarding(with: prefs ?? preferences)
    }

    func login(user: AuthUser, session: AuthSession?) {
        currentUser = user
        isAuthenticated = true
        isGuest = false
        defaults.saveAuthUser(user)
        UserDefaults.standard.set(false, forKey: "is_guest_user")
        if let token = session?.accessToken { keychain.accessToken = token }
        if let refresh = session?.refreshToken { keychain.refreshToken = refresh }
    }

    func logout() {
        currentUser = nil
        isAuthenticated = false
        isGuest = false
        isOnboardingComplete = false
        preferences = .empty
        keychain.accessToken = nil
        keychain.refreshToken = nil
        defaults.clearAll()
        UserDefaults.standard.removeObject(forKey: "is_guest_user")
    }

    func updatePreferences(_ prefs: UserPreferences) {
        preferences = prefs
        defaults.savePreferences(prefs)
    }
}
