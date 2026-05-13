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
            notificationsEnabled: defaults.bool(forKey: Keys.notificationsEnabled)
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

    // MARK: - Pending Preferences Sync
    //
    // When the post-signup PATCH to /api/user/preferences fails (transient
    // network error, app backgrounded mid-flight, etc.) we stash the prefs
    // here so AppViewModel can re-attempt the sync on next launch or login.
    // Without this, a user's onboarding selections could silently never reach
    // the backend — that's the root cause of "new account gets cold-trending
    // instead of personalized" we hit on 2026-05-13.

    private static let pendingSyncKey = "pending_preferences_sync"

    func queuePendingPreferencesSync(_ prefs: UserPreferences) {
        if let data = try? JSONEncoder().encode(prefs) {
            defaults.set(data, forKey: Self.pendingSyncKey)
        }
    }

    func loadPendingPreferencesSync() -> UserPreferences? {
        guard let data = defaults.data(forKey: Self.pendingSyncKey) else { return nil }
        return try? JSONDecoder().decode(UserPreferences.self, from: data)
    }

    func clearPendingPreferencesSync() {
        defaults.removeObject(forKey: Self.pendingSyncKey)
    }
}

// MARK: - SessionManager
//
// Single source of truth for "who is logged in." Every store that holds
// per-user state (photos, follows, likes, bookmarks, history, ...) registers
// once with SessionManager. When the active user changes (login / logout /
// account switch), SessionManager notifies every registered store BEFORE the
// new identity is read anywhere — so leaked state from the previous user is
// impossible by construction.
//
// Why a registry instead of just calling each manager from AppViewModel:
//
//   On 2026-05-13 a brand new account created on top of an existing session
//   ended up showing the previous user's profile picture, follow graph, and
//   onboarding-selected topics. The cause was that `ProfilePhotoManager`,
//   `FollowManager`, and `UserFollowManager` had to be reset by hand in
//   AppViewModel.logout() but were forgotten there. Future managers will
//   make the same mistake unless wire-up is centralized.
//
// Pattern: conform to UserScopedStore. In your singleton's init, call
// `SessionManager.shared.register(self)`. SessionManager calls back on user
// switch. That's the whole contract.

/// A store that holds state scoped to a single signed-in user. Implementers
/// must drop the previous user's state in `resetForUserSwitch()` and rebind
/// to the new user (if any) in `loadForActiveUser(_:)`.
@MainActor
protocol UserScopedStore: AnyObject {
    /// Called when the active user is about to change. Drop all in-memory
    /// state from the previous user. Persistent state should be namespaced
    /// by user id so the disk file/key for the previous user remains intact
    /// (so the same user can return later and recover).
    func resetForUserSwitch()

    /// Called immediately after `resetForUserSwitch` with the new active user
    /// id (or nil for guest / signed-out). Re-bind to the new identity.
    func loadForActiveUser(_ userId: String?)
}

@MainActor
final class SessionManager {
    static let shared = SessionManager()
    private init() {}

    /// The currently logged-in user id, or nil for guest/signed-out.
    private(set) var activeUserId: String?

    /// Weak references so a deallocated store doesn't keep us pinned.
    private var stores: [WeakStoreRef] = []

    func register(_ store: UserScopedStore) {
        stores.removeAll { $0.value == nil }
        if !stores.contains(where: { $0.value === store }) {
            stores.append(WeakStoreRef(value: store))
        }
    }

    /// Switch the active user. All registered stores are reset, then bound
    /// to the new user id (or nil). Always call this — never set per-store
    /// active users directly, or you reintroduce the wire-up gap that caused
    /// the original cross-user leak.
    func setActiveUser(_ newId: String?) {
        let live = stores.compactMap(\.value)
        live.forEach { $0.resetForUserSwitch() }
        activeUserId = newId
        live.forEach { $0.loadForActiveUser(newId) }

        #if DEBUG
        // Tripwire: anything that registers AFTER this point will miss the
        // reset for this transition. Print a one-line warning so the bug is
        // caught the first time it happens in a debug build.
        Task { @MainActor in
            let registeredCount = self.stores.compactMap(\.value).count
            if registeredCount < live.count {
                print("⚠️ SessionManager: store count dropped during setActiveUser — late registration?")
            }
        }
        #endif
    }
}

@MainActor
private struct WeakStoreRef {
    weak var value: (any UserScopedStore)?
}
