import UIKit

/// Saves and loads the user's profile photo to the app's documents directory.
final class ProfilePhotoManager: @unchecked Sendable {
    static let shared = ProfilePhotoManager()
    private init() {}

    private var fileURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("profile_photo.jpg")
    }

    func save(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.85) else { return }
        try? data.write(to: fileURL)
    }

    func load() -> UIImage? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return UIImage(data: data)
    }

    func delete() {
        try? FileManager.default.removeItem(at: fileURL)
    }
}
