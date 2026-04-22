import UIKit

/// Saves and loads the user's profile photo to the app's documents directory.
final class ProfilePhotoManager: @unchecked Sendable {
    static let shared = ProfilePhotoManager()
    private init() {}

    private let avatarKey = "selected_default_avatar"

    private var fileURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("profile_photo.jpg")
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

    /// Clears everything — resets to letter initial
    func resetToDefault() {
        delete()
        clearDefaultAvatar()
    }
}
