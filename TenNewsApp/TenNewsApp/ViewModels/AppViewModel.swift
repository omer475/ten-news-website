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
            // Load this user's likes/bookmarks from their per-user storage
            LikeManager.shared.switchUser(user.id)
            BookmarkManager.shared.switchUser(user.id)
            LikeManager.shared.restoreFromServer(userId: user.id)
            BookmarkManager.shared.restoreFromServer(userId: user.id)
            // Sync read count from server
            Task.detached {
                await Self.syncReadCount(userId: user.id)
            }
        }
        if keychain.accessToken != nil { isAuthenticated = true; isGuest = false }
    }

    func completeOnboarding(with prefs: UserPreferences) {
        preferences = prefs
        isOnboardingComplete = true
        defaults.savePreferences(prefs)
        defaults.isOnboardingCompleted = true

        // Sync preferences to server — use Task.detached so it survives view dismissal
        // (the sheet closes immediately after onSignup, cancelling regular Tasks)
        if let userId = currentUser?.id {
            let home = prefs.homeCountry
            let countries = prefs.followedCountries
            let topics = prefs.followedTopics
            let token = keychain.accessToken
            Task.detached {
                await Self.syncPreferencesToServer(
                    userId: userId,
                    homeCountry: home,
                    followedCountries: countries,
                    followedTopics: topics,
                    accessToken: token
                )
            }
        }
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
        // Switch to this user's data (per-user storage, no data loss)
        LikeManager.shared.switchUser(user.id)
        BookmarkManager.shared.switchUser(user.id)
        // Restore from server if local is empty (e.g., first login on new device, or after data wipe)
        LikeManager.shared.restoreFromServer(userId: user.id)
        BookmarkManager.shared.restoreFromServer(userId: user.id)
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
        // Switch managers to guest — each user's data stays in their own keys
        LikeManager.shared.switchUser(nil)
        BookmarkManager.shared.switchUser(nil)
        ReadingHistoryManager.shared.clearHistory()
        FollowManager.shared.clearAll()
        UserDefaults.standard.removeObject(forKey: "followed_event_slugs")
    }

    /// Sync read count from server events
    private static func syncReadCount(userId: String) async {
        guard let url = URL(string: "https://www.tennews.ai/api/user/liked?user_id=\(userId)") else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let likedIds = json["liked_ids"] as? [String] {
                // liked_ids count is a proxy for engagement — but we need actual read count
                // Use a simple heuristic: fetch the profile's articles_read_count from server
            }
        } catch { }
        // Direct count from profiles table
        guard let profileUrl = URL(string: "https://www.tennews.ai/api/user/preferences?user_id=\(userId)") else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: profileUrl)
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let readCount = json["articles_read_count"] as? Int {
                await MainActor.run {
                    ReadingHistoryManager.shared.syncReadCount(serverCount: readCount)
                }
            }
        } catch { }
    }

    /// Direct HTTP sync — static + detached to survive view dismissal
    private static func syncPreferencesToServer(userId: String, homeCountry: String?, followedCountries: [String], followedTopics: [String], accessToken: String?) async {
        guard let url = URL(string: "https://www.tennews.ai/api/user/preferences") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let body: [String: Any] = [
            "auth_user_id": userId,
            "home_country": homeCountry ?? "",
            "followed_countries": followedCountries,
            "followed_topics": followedTopics,
            "onboarding_completed": true
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let responseStr = String(data: data, encoding: .utf8) ?? ""
            print("Preferences sync: status=\(status) response=\(responseStr)")
        } catch {
            print("Preferences sync error: \(error.localizedDescription)")
        }
    }


    func updatePreferences(_ prefs: UserPreferences) {
        preferences = prefs
        defaults.savePreferences(prefs)
    }
}
