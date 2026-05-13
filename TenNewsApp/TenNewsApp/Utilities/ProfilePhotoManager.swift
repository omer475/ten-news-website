import UIKit

/// Saves and loads the user's profile photo to the app's documents directory.
///
/// Storage is namespaced by the active user id (`profile_photo_<userId>.jpg`
/// + `selected_default_avatar_<userId>` UserDefault). Even if a future bug
/// forgets to wipe state on logout, the next user reads from a different
/// path/key — so cross-user photo leaks are impossible at the storage layer.
///
/// Active user is tracked by SessionManager via the UserScopedStore protocol.
@MainActor
final class ProfilePhotoManager: @unchecked Sendable {
    static let shared = ProfilePhotoManager()
    private init() {
        // One-time migration: the legacy un-namespaced file/key existed before
        // user-scoped namespacing. Wipe it once on first init so no leftover
        // photo can attach to whichever user happens to log in next.
        let legacyURL = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("profile_photo.jpg")
        try? FileManager.default.removeItem(at: legacyURL)
        UserDefaults.standard.removeObject(forKey: "selected_default_avatar")

        SessionManager.shared.register(self)
    }

    /// Currently-active user id for namespacing. nil = guest slot.
    private var activeUserId: String?

    private var fileURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let name = (activeUserId?.isEmpty == false)
            ? "profile_photo_\(activeUserId!).jpg"
            : "profile_photo_guest.jpg"
        return docs.appendingPathComponent(name)
    }

    private var avatarKey: String {
        (activeUserId?.isEmpty == false)
            ? "selected_default_avatar_\(activeUserId!)"
            : "selected_default_avatar_guest"
    }

    func save(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.85) else { return }
        try? data.write(to: fileURL)
        clearDefaultAvatar()
    }

    func load() -> UIImage? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return UIImage(data: data)
    }

    func delete() {
        try? FileManager.default.removeItem(at: fileURL)
    }

    // MARK: - Default Avatar Selection

    func saveDefaultAvatar(_ index: Int) {
        UserDefaults.standard.set(index, forKey: avatarKey)
        delete() // Remove custom photo when selecting a default avatar
    }

    func selectedDefaultAvatar() -> Int? {
        let val = UserDefaults.standard.integer(forKey: avatarKey)
        return val > 0 ? val : nil
    }

    func clearDefaultAvatar() {
        UserDefaults.standard.removeObject(forKey: avatarKey)
    }

    /// Clears the active user's photo + default avatar selection. Files for
    /// other users remain on disk untouched.
    func resetToDefault() {
        delete()
        clearDefaultAvatar()
    }
}

// MARK: - UserScopedStore conformance

extension ProfilePhotoManager: UserScopedStore {
    /// Drop the active-user pointer so any read before loadForActiveUser
    /// goes to the guest slot rather than leaking the previous user's path.
    func resetForUserSwitch() {
        activeUserId = nil
    }
    func loadForActiveUser(_ userId: String?) {
        activeUserId = userId
    }
}
