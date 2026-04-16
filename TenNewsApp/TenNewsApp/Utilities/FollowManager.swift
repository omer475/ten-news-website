import Foundation

/// Manages followed publishers using UserDefaults.
/// Stores publisher IDs locally; syncs with API when available.
@MainActor @Observable
final class FollowManager {
    static let shared = FollowManager()

    private(set) var followedIDs: Set<String> = []

    private let key = "followed_publisher_ids"
    private let publisherService = PublisherService()

    private init() {
        followedIDs = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
    }

    func isFollowing(_ publisherId: String?) -> Bool {
        guard let id = publisherId else { return false }
        return followedIDs.contains(id)
    }

    func toggle(_ publisherId: String?, userId: String?) {
        guard let id = publisherId else { return }
        let wasFollowing = followedIDs.contains(id)

        if wasFollowing {
            followedIDs.remove(id)
        } else {
            followedIDs.insert(id)
        }
        save()

        // Sync with API
        guard let userId else { return }
        Task {
            do {
                if !wasFollowing {
                    _ = try await publisherService.follow(publisherId: id, userId: userId)
                } else {
                    _ = try await publisherService.unfollow(publisherId: id, userId: userId)
                }
            } catch {
                // Revert on failure
                if wasFollowing {
                    followedIDs.insert(id)
                } else {
                    followedIDs.remove(id)
                }
                save()
            }
        }
    }

    func clearAll() {
        followedIDs.removeAll()
        UserDefaults.standard.removeObject(forKey: key)
    }

    private func save() {
        UserDefaults.standard.set(Array(followedIDs), forKey: key)
    }
}
