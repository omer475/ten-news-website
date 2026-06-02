import SwiftUI
import os

private let followingLog = Logger(subsystem: "com.tennews.app", category: "FollowingFeed")

/// Owns state for the "Following" tab on the main feed — articles from
/// publishers the user follows, in pure chronological order. No re-ranker,
/// no scoring, no diversity discount.
///
/// State machine surfaces an `apiState` so the view can render distinct
/// UX for: API not yet shipped (Coming Soon), zero follows (empty state),
/// loaded (cards), error (retry).
@MainActor @Observable
final class FollowingFeedViewModel {
    enum APIState {
        case idle              // not yet fetched
        case loading           // initial load
        case loaded            // articles present
        case empty             // server returned 0 articles AND user has follows
        case notFollowingAnyone // user has 0 follows → don't even bother calling API
        case comingSoon        // endpoint returned 404 (algorithm terminal hasn't shipped it yet)
        case error(String)
    }

    var allArticles: [Article] = []
    var apiState: APIState = .idle
    var isRefreshing = false
    var hasMore = true
    private var nextCursor: String?

    private let service = FeedService()
    private let fetchLimit = 20

    /// Read by the view to know if we should show the empty-state for the
    /// "0 follows" case. Source of truth = FollowManager, since the
    /// publisher graph lives there.
    private var followCount: Int { FollowManager.shared.followedPublishers.count }

    func loadInitialIfNeeded(userId: String?) async {
        // Don't re-fetch if we already have content; refresh is a separate flow.
        if case .loaded = apiState, !allArticles.isEmpty { return }
        if case .loading = apiState { return }
        await fetchPage(userId: userId, cursor: nil, replace: true)
    }

    func refresh(userId: String?) async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        nextCursor = nil
        hasMore = true
        await fetchPage(userId: userId, cursor: nil, replace: true)
    }

    func loadMoreIfNeeded(userId: String?) async {
        guard hasMore, !isRefreshing, case .loaded = apiState else { return }
        await fetchPage(userId: userId, cursor: nextCursor, replace: false)
    }

    private func fetchPage(userId: String?, cursor: String?, replace: Bool) async {
        // Short-circuit: a guest with no user id cannot have follows.
        guard let uid = userId, !uid.isEmpty else {
            apiState = .notFollowingAnyone
            allArticles = []
            return
        }
        // Short-circuit: user follows nobody — don't even hit the API.
        if followCount == 0 {
            apiState = .notFollowingAnyone
            allArticles = []
            return
        }
        if replace { apiState = .loading }

        do {
            let resp = try await service.fetchFollowingFeed(
                userId: uid,
                cursor: cursor,
                limit: fetchLimit
            )
            if replace {
                allArticles = resp.articles
            } else {
                let existing = Set(allArticles.map(\.id.stringValue))
                allArticles.append(contentsOf: resp.articles.filter { !existing.contains($0.id.stringValue) })
            }
            nextCursor = resp.nextCursor
            hasMore = resp.hasMore
            if allArticles.isEmpty {
                apiState = .empty
            } else {
                apiState = .loaded
            }
            followingLog.warning("following feed page: \(resp.articles.count) new, hasMore=\(resp.hasMore), total=\(self.allArticles.count)")
        } catch let urlErr as URLError where urlErr.code == .fileDoesNotExist {
            // APIClient surfaces 404 as this URLError code in many setups.
            apiState = .comingSoon
        } catch {
            // 404 detection from APIClient varies by setup — also check error string.
            let message = error.localizedDescription
            if message.contains("404") || message.lowercased().contains("not found") {
                apiState = .comingSoon
                followingLog.warning("following feed endpoint not deployed yet (404)")
            } else if case .loaded = apiState, !allArticles.isEmpty {
                // Pagination failed but we already have content — keep what we have.
                followingLog.error("following feed loadMore failed: \(message, privacy: .public)")
            } else {
                apiState = .error(message)
                followingLog.error("following feed failed: \(message, privacy: .public)")
            }
        }
    }

    /// Called from MainFeedView when FollowManager publishes a change — if
    /// the user goes from 0 → 1 follow we want to flip out of the
    /// notFollowingAnyone state and try the API.
    func handleFollowCountChange(userId: String?) {
        if case .notFollowingAnyone = apiState, followCount > 0 {
            Task { await loadInitialIfNeeded(userId: userId) }
        } else if followCount == 0 {
            apiState = .notFollowingAnyone
            allArticles = []
        }
    }
}
