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
        if ProcessInfo.processInfo.arguments.contains("--screenshot-welcome") {
            isOnboardingComplete = false
            return
        }
        isOnboardingComplete = defaults.isOnboardingCompleted
        if let prefs = defaults.loadUserPreferences() { preferences = prefs }
        if let user = defaults.loadAuthUser() {
            currentUser = user
            isGuest = UserDefaults.standard.bool(forKey: "is_guest_user")
            isAuthenticated = !isGuest
            // SessionManager fans out to every user-scoped store. After this
            // call, every Like/Bookmark/Follow/Photo/History manager is bound
            // to this user. No per-manager wiring needed here.
            SessionManager.shared.setActiveUser(user.id)
            LikeManager.shared.restoreFromServer(userId: user.id)
            BookmarkManager.shared.restoreFromServer(userId: user.id)
            Task.detached {
                await Self.syncReadCount(userId: user.id)
            }
            // Re-attempt any preferences sync that was queued from a previous
            // launch (e.g. PATCH failed during onboarding).
            retryPendingPreferencesSyncIfNeeded(userId: user.id)
        }
        if keychain.accessToken != nil { isAuthenticated = true; isGuest = false }
    }

    func completeOnboarding(with prefs: UserPreferences) {
        preferences = prefs
        isOnboardingComplete = true
        defaults.savePreferences(prefs)
        defaults.isOnboardingCompleted = true

        // Sync preferences to server. Detached so it survives view dismissal
        // (the signup sheet closes immediately after onSignup, cancelling
        // any regular Task). Includes retries on transient failures + queues
        // the prefs to disk if the PATCH never lands, so the next launch can
        // re-try and the user's selections still reach the backend.
        guard let userId = currentUser?.id else {
            print("⚠️ completeOnboarding: no currentUser, queuing prefs for next launch")
            defaults.queuePendingPreferencesSync(prefs)
            return
        }
        let token = keychain.accessToken
        Task.detached {
            let ok = await Self.syncPreferencesToServerWithRetry(
                userId: userId,
                prefs: prefs,
                accessToken: token,
                attempts: 5
            )
            if !ok {
                await MainActor.run {
                    UserDefaultsManager.shared.queuePendingPreferencesSync(prefs)
                }
            }
        }
    }

    /// Re-try a previously failed preferences sync. Called from loadState
    /// and login so a PATCH that died mid-flight gets a second chance.
    private func retryPendingPreferencesSyncIfNeeded(userId: String) {
        guard let pending = defaults.loadPendingPreferencesSync() else { return }
        let token = keychain.accessToken
        Task.detached {
            let ok = await Self.syncPreferencesToServerWithRetry(
                userId: userId,
                prefs: pending,
                accessToken: token,
                attempts: 3
            )
            if ok {
                await MainActor.run {
                    UserDefaultsManager.shared.clearPendingPreferencesSync()
                }
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
        // If a different identity was active (or the user was a guest), wipe
        // every per-user store first so we never inherit the previous user's
        // photo, follows, likes, history, etc. SessionManager fans this out
        // to every registered UserScopedStore — no per-manager wire-up needed.
        if let previous = currentUser?.id, previous != user.id {
            SessionManager.shared.setActiveUser(nil)
            keychain.accessToken = nil
            keychain.refreshToken = nil
            defaults.clearAll()
            UserDefaults.standard.removeObject(forKey: "is_guest_user")
            UserDefaults.standard.removeObject(forKey: "auth_user_id")
            UserDefaults.standard.removeObject(forKey: "user_id")
            UserDefaults.standard.removeObject(forKey: "followed_event_slugs")
        }

        // Bind every store to the new user.
        SessionManager.shared.setActiveUser(user.id)
        LikeManager.shared.restoreFromServer(userId: user.id)
        BookmarkManager.shared.restoreFromServer(userId: user.id)

        currentUser = user
        isAuthenticated = true
        isGuest = false
        defaults.saveAuthUser(user)
        UserDefaults.standard.set(false, forKey: "is_guest_user")
        if let token = session?.accessToken { keychain.accessToken = token }
        if let refresh = session?.refreshToken { keychain.refreshToken = refresh }

        // Re-try any preferences sync queued by a previous session.
        retryPendingPreferencesSyncIfNeeded(userId: user.id)
    }

    func logout() {
        SessionManager.shared.setActiveUser(nil)
        currentUser = nil
        isAuthenticated = false
        isGuest = false
        isOnboardingComplete = false
        preferences = .empty
        keychain.accessToken = nil
        keychain.refreshToken = nil
        defaults.clearAll()
        UserDefaults.standard.removeObject(forKey: "is_guest_user")
        UserDefaults.standard.removeObject(forKey: "auth_user_id")
        UserDefaults.standard.removeObject(forKey: "user_id")
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

    /// One HTTP attempt. Returns true on 2xx so callers can decide whether
    /// to retry. Static + detached-friendly so it survives view dismissal.
    private static func syncPreferencesToServer(userId: String, homeCountry: String?, followedCountries: [String], followedTopics: [String], accessToken: String?) async -> Bool {
        guard let url = URL(string: "https://www.tennews.ai/api/user/preferences") else { return false }
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
            return (200...299).contains(status)
        } catch {
            print("Preferences sync error: \(error.localizedDescription)")
            return false
        }
    }

    /// Try the PATCH with exponential backoff. Survives transient network
    /// failures + brief auth-token races right after signup. Returns true
    /// only when the server actually accepted the write.
    private static func syncPreferencesToServerWithRetry(
        userId: String,
        prefs: UserPreferences,
        accessToken: String?,
        attempts: Int
    ) async -> Bool {
        var delayNs: UInt64 = 1_000_000_000 // 1s
        for attempt in 1...attempts {
            let ok = await syncPreferencesToServer(
                userId: userId,
                homeCountry: prefs.homeCountry,
                followedCountries: prefs.followedCountries,
                followedTopics: prefs.followedTopics,
                accessToken: accessToken
            )
            if ok { return true }
            if attempt < attempts {
                try? await Task.sleep(nanoseconds: delayNs)
                delayNs = min(delayNs * 2, 16_000_000_000) // cap at 16s
            }
        }
        return false
    }


    func updatePreferences(_ prefs: UserPreferences) {
        preferences = prefs
        defaults.savePreferences(prefs)
    }
}
