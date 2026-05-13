import Foundation

/// Source of truth for the USER → USER social graph from the current user's
/// perspective. Separate from FollowManager (user → publisher) because the
/// graphs are stored in different tables (user_user_follows vs user_follows)
/// and the surfaces overlap on the Account tab — keeping them split avoids
/// id-collision between publisher_id and profile_id.
///
/// Optimistic mutations: toggle() flips the local set immediately, fires the
/// API call in the background, and reverts on failure. Follower / following
/// counts are owned by this manager too (refreshed from API responses) so
/// the AccountTabView stats stay in sync without per-view fetches.
@MainActor @Observable
final class UserFollowManager {
    static let shared = UserFollowManager()

    /// Profile ids that the current user follows (people, not publishers).
    private(set) var followedUserIDs: Set<String> = []
    /// Cached profile metadata for the followed-user list view.
    private(set) var followedUsers: [SocialProfile] = []
    /// People who follow the current user. Refreshed on Account tab open.
    private(set) var followers: [SocialProfile] = []

    /// Aggregate counts (driven by the API count field, NOT the local arrays
    /// — pagination would make the array shorter than the true count).
    private(set) var followerCount: Int = 0
    private(set) var followingCount: Int = 0

    private var currentUserId: String?
    private let service = UserService()

    private init() {
        SessionManager.shared.register(self)
    }

    /// Inform the manager of the current logged-in user. Triggers an initial
    /// fetch of both sides of the graph. Called from AppViewModel.login and
    /// AccountTabView.onAppear.
    func setCurrentUser(_ userId: String?) {
        let changed = userId != currentUserId
        currentUserId = userId
        if changed {
            followedUserIDs.removeAll()
            followedUsers.removeAll()
            followers.removeAll()
            followerCount = 0
            followingCount = 0
        }
        Task { await refresh() }
    }
}

// MARK: - UserScopedStore conformance

extension UserFollowManager: UserScopedStore {
    func resetForUserSwitch() {
        currentUserId = nil
        followedUserIDs.removeAll()
        followedUsers.removeAll()
        followers.removeAll()
        followerCount = 0
        followingCount = 0
    }
    func loadForActiveUser(_ userId: String?) {
        setCurrentUser(userId)
    }

    /// Pull both followers and following lists from the server. Cheap enough
    /// to call from .onAppear; the API endpoints are single-table reads.
    func refresh() async {
        guard let uid = currentUserId else { return }
        async let followersResp = service.fetchUserFollowers(userId: uid, limit: 100)
        async let followingResp = service.fetchUserFollowing(userId: uid, limit: 100)
        do {
            let fResp = try await followersResp
            let gResp = try await followingResp
            followers = fResp.users
            followerCount = fResp.count
            followedUsers = gResp.users
            followingCount = gResp.count
            followedUserIDs = Set(gResp.users.map(\.id))
        } catch {
            // Silent: stale state is better than throwing on a passive sync.
        }
    }

    func isFollowing(_ userId: String) -> Bool {
        followedUserIDs.contains(userId)
    }

    /// Optimistic toggle. Flips local state immediately, calls the API in the
    /// background, reverts on failure. Mirrors FollowManager.toggle's contract.
    func toggle(_ target: SocialProfile) {
        guard let viewerId = currentUserId, viewerId != target.id else { return }
        let wasFollowing = followedUserIDs.contains(target.id)

        if wasFollowing {
            followedUserIDs.remove(target.id)
            followedUsers.removeAll { $0.id == target.id }
            followingCount = max(0, followingCount - 1)
        } else {
            followedUserIDs.insert(target.id)
            followedUsers.removeAll { $0.id == target.id }
            followedUsers.insert(target, at: 0)
            followingCount += 1
        }

        Task {
            do {
                if wasFollowing {
                    _ = try await service.unfollowUser(targetId: target.id, followerId: viewerId)
                } else {
                    _ = try await service.followUser(targetId: target.id, followerId: viewerId)
                }
            } catch {
                // Revert on failure.
                await MainActor.run {
                    if wasFollowing {
                        followedUserIDs.insert(target.id)
                        followedUsers.removeAll { $0.id == target.id }
                        followedUsers.insert(target, at: 0)
                        followingCount += 1
                    } else {
                        followedUserIDs.remove(target.id)
                        followedUsers.removeAll { $0.id == target.id }
                        followingCount = max(0, followingCount - 1)
                    }
                }
            }
        }
    }

    /// Used by UserProfileView after a profile fetch — reconciles local state
    /// with the server's authoritative is_following flag (cross-device case).
    func syncFromServer(profile: SocialProfile, isFollowing: Bool) {
        if isFollowing {
            if !followedUserIDs.contains(profile.id) {
                followedUserIDs.insert(profile.id)
                followedUsers.removeAll { $0.id == profile.id }
                followedUsers.insert(profile, at: 0)
                followingCount += 1
            }
        } else {
            if followedUserIDs.contains(profile.id) {
                followedUserIDs.remove(profile.id)
                followedUsers.removeAll { $0.id == profile.id }
                followingCount = max(0, followingCount - 1)
            }
        }
    }
}
