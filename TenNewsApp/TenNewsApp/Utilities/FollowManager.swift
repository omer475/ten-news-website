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

    func toggle(_ publisherId: String?, userId: String?, sourceArticleId: Int? = nil) {
        guard let id = publisherId else { return }
        let wasFollowing = followedIDs.contains(id)

        if wasFollowing {
            followedIDs.remove(id)
        } else {
            followedIDs.insert(id)
        }
        save()

        // Audit fix B3 (2026-05-06): emit analytics on follow/unfollow.
        // Following a publisher is one of TikTok's strongest positive signals
        // (~25× a like per Twitter open-source weights). Previously this fired
        // ZERO events, so Trinity had no signal from a high-affordance UI.
        Task {
            let analytics = AnalyticsService()
            var meta: [String: String] = ["publisher_id": id]
            if let sourceArticleId { meta["source_article_id"] = String(sourceArticleId) }
            try? await analytics.track(
                event: wasFollowing ? "publisher_unfollowed" : "publisher_followed",
                articleId: sourceArticleId,
                metadata: meta
            )
        }

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
