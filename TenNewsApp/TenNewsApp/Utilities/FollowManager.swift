import Foundation

/// Minimal payload stored alongside `followedIDs` so the Following list on
/// the Account tab can render rich rows (avatar + name + category) without a
/// network fetch per row. Backfilled lazily: any pre-existing follow that
/// lacks metadata stays in `followedIDs` and is rendered with an id-only
/// fallback row.
struct FollowedPublisher: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var avatarUrl: String?
    var category: String?
}

/// Manages followed publishers using UserDefaults.
/// Source of truth for the follow state across the app:
///   - ArticleCardContinuousView's inline `+` chip
///   - CreatorProfileView's Follow / Following button
///   - AccountTabView's Following stat + FollowingListView
/// Toggling anywhere updates everywhere via @Observable.
@MainActor @Observable
final class FollowManager {
    static let shared = FollowManager()

    private(set) var followedIDs: Set<String> = []
    /// Rich metadata keyed by publisher id. Populated when callers pass a
    /// name / avatar at toggle time (e.g. from an article card). Pre-existing
    /// follows have an id-only entry until the user opens the publisher's
    /// profile, which calls `upsert(publisher:)`.
    private(set) var followedPublishers: [FollowedPublisher] = []

    private let idsKey = "followed_publisher_ids"
    private let publishersKey = "followed_publishers_data"
    private let publisherService = PublisherService()

    private init() {
        followedIDs = Set(UserDefaults.standard.stringArray(forKey: idsKey) ?? [])
        if let data = UserDefaults.standard.data(forKey: publishersKey),
           let decoded = try? JSONDecoder().decode([FollowedPublisher].self, from: data) {
            followedPublishers = decoded
        }
        // Backfill: any id in followedIDs without a publisher entry gets a
        // placeholder so the Following list can still render the row.
        let known = Set(followedPublishers.map(\.id))
        for id in followedIDs where !known.contains(id) {
            followedPublishers.append(FollowedPublisher(id: id, name: "Publisher", avatarUrl: nil, category: nil))
        }
    }

    func isFollowing(_ publisherId: String?) -> Bool {
        guard let id = publisherId else { return false }
        return followedIDs.contains(id)
    }

    /// Legacy API kept for back-compat with the inline `+` chip's older
    /// callsites that don't carry publisher metadata. Routes into the
    /// richer toggle with an empty payload — list rows for these follows
    /// fall back to an id-only display until enriched elsewhere.
    func toggle(_ publisherId: String?, userId: String?, sourceArticleId: Int? = nil) {
        toggle(publisherId, name: nil, avatarUrl: nil, category: nil, userId: userId, sourceArticleId: sourceArticleId)
    }

    /// Rich toggle. Pass the publisher's display name + avatar when available
    /// so the Following list renders a real row instead of a placeholder.
    func toggle(
        _ publisherId: String?,
        name: String?,
        avatarUrl: String?,
        category: String?,
        userId: String?,
        sourceArticleId: Int? = nil
    ) {
        guard let id = publisherId else { return }
        let wasFollowing = followedIDs.contains(id)

        if wasFollowing {
            followedIDs.remove(id)
            followedPublishers.removeAll { $0.id == id }
        } else {
            followedIDs.insert(id)
            let entry = FollowedPublisher(
                id: id,
                name: name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? name! : "Publisher",
                avatarUrl: avatarUrl,
                category: category
            )
            // De-dupe: insert at front, drop any prior entry for this id.
            followedPublishers.removeAll { $0.id == id }
            followedPublishers.insert(entry, at: 0)
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
                    followedPublishers.removeAll { $0.id == id }
                }
                save()
            }
        }
    }

    /// Patch the metadata for an existing follow (e.g. CreatorProfileView
    /// loads full publisher data after a follow that happened from a card
    /// row with thin metadata).
    func upsertMetadata(id: String, name: String, avatarUrl: String?, category: String?) {
        guard followedIDs.contains(id) else { return }
        if let i = followedPublishers.firstIndex(where: { $0.id == id }) {
            followedPublishers[i].name = name.isEmpty ? followedPublishers[i].name : name
            followedPublishers[i].avatarUrl = avatarUrl ?? followedPublishers[i].avatarUrl
            followedPublishers[i].category = category ?? followedPublishers[i].category
        } else {
            followedPublishers.insert(
                FollowedPublisher(id: id, name: name, avatarUrl: avatarUrl, category: category),
                at: 0
            )
        }
        save()
    }

    func clearAll() {
        followedIDs.removeAll()
        followedPublishers.removeAll()
        UserDefaults.standard.removeObject(forKey: idsKey)
        UserDefaults.standard.removeObject(forKey: publishersKey)
    }

    private func save() {
        UserDefaults.standard.set(Array(followedIDs), forKey: idsKey)
        if let data = try? JSONEncoder().encode(followedPublishers) {
            UserDefaults.standard.set(data, forKey: publishersKey)
        }
    }
}
