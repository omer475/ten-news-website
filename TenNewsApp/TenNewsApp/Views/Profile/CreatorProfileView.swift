import SwiftUI

struct CreatorProfileView: View {
    let creator: Creator
    let articles: [Article]
    let onDismiss: () -> Void
    var onArticleTap: ((Article) -> Void)?

    // Publisher data (fetched from API when publisherId is available)
    var publisherId: String?

    @State private var followerCount: Int = 0
    @State private var publisherArticles: [Article] = []
    @State private var isLoadingArticles = false
    @State private var currentPage = 0
    @State private var hasMore = true
    @State private var displayName: String = ""
    @State private var displayBio: String = ""
    @State private var displayUsername: String = ""
    @State private var displayCategory: String?
    @State private var displayIsVerified = false
    @State private var displayAvatarUrl: String?
    @State private var articleCount: Int = 0
    @State private var followingCount: Int = 0
    @State private var hasLoaded = false
    @State private var followManager = FollowManager.shared

    @Environment(AppViewModel.self) private var appViewModel
    @Environment(FeedViewModel.self) private var feedViewModel

    private let publisherService = PublisherService()

    /// Authoritative follow state: read from FollowManager so it stays in
    /// sync with every other follow surface (article-card chip, Following
    /// list pill). Previously CreatorProfileView held its own @State and
    /// could diverge from FollowManager on a fetch-but-not-mutation failure.
    private var isFollowing: Bool {
        guard let pubId = publisherId else { return false }
        return followManager.isFollowing(pubId)
    }

    private let logoColors: [Color] = [.blue, .purple, .pink, .orange, .teal, .indigo, .mint, .cyan]
    private var logoColor: Color {
        logoColors[abs((displayName.isEmpty ? creator.name : displayName).hashValue) % logoColors.count]
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    profileHeader
                        .padding(.top, 80)

                    statsRow
                        .padding(.top, 24)
                        .padding(.horizontal, 20)

                    actionButtons
                        .padding(.top, 20)
                        .padding(.horizontal, 20)

                    // Bio
                    let bio = displayBio.isEmpty ? creator.bio : displayBio
                    if !bio.isEmpty {
                        Text(bio)
                            .font(.system(size: 14))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .lineSpacing(3)
                            .padding(.horizontal, 32)
                            .padding(.top, 16)
                    }

                    publishedSection
                        .padding(.top, 28)
                }
                .padding(.bottom, 120)
            }

            // Back button — flat circle, no glass effect or shadow.
            Button {
                onDismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.primary)
                    .frame(width: 38, height: 38)
                    .background(.fill.quaternary, in: Circle())
            }
            .buttonStyle(.plain)
            .padding(.top, 56)
            .padding(.leading, 20)
        }
        .background(Theme.Colors.backgroundPrimary.ignoresSafeArea())
        .ignoresSafeArea()
        .swipeToDismiss { onDismiss() }
        .task {
            guard !hasLoaded else { return }
            hasLoaded = true
            displayName = creator.name
            displayBio = creator.bio
            displayUsername = creator.username
            displayCategory = creator.category
            displayIsVerified = creator.isVerified
            followerCount = creator.followerCount
            followingCount = creator.followingCount
            articleCount = creator.articleCount

            if let pubId = publisherId {
                await loadPublisherData(pubId)
                await loadArticles(pubId)
            }
        }
    }

    // MARK: - Data Loading

    private func loadPublisherData(_ pubId: String) async {
        do {
            let response = try await publisherService.fetchPublisher(
                id: pubId,
                userId: appViewModel.currentUser?.id
            )
            let pub = response.publisher
            displayName = pub.displayName
            displayUsername = pub.username
            displayBio = pub.bio ?? ""
            displayCategory = pub.category
            displayIsVerified = pub.isVerified
            displayAvatarUrl = pub.avatarUrl
            followerCount = pub.followerCount
            articleCount = pub.articleCount
            // Sync FollowManager with the server's authoritative is_following
            // flag (handles the cross-device case where the user followed on
            // web but FollowManager's local cache doesn't know).
            followManager.syncFromServer(
                publisherId: pubId,
                isFollowing: response.isFollowing,
                name: pub.displayName,
                avatarUrl: pub.avatarUrl,
                category: pub.category
            )
        } catch {
            print("Failed to load publisher: \(error)")
        }
    }

    private func loadArticles(_ pubId: String) async {
        guard !isLoadingArticles else { return }
        isLoadingArticles = true
        defer { isLoadingArticles = false }

        do {
            let response = try await publisherService.fetchArticles(publisherId: pubId, page: currentPage)
            publisherArticles.append(contentsOf: response.articles)
            hasMore = response.hasMore
            currentPage += 1
        } catch {
            print("Failed to load publisher articles: \(error)")
        }
    }

    private func toggleFollow() {
        guard let pubId = publisherId else { return }

        let willFollow = !isFollowing
        followerCount += willFollow ? 1 : -1
        HapticManager.medium()

        // FollowManager is the single source of truth. It owns the API
        // call, the optimistic update + revert on failure, and the
        // publisher_followed / publisher_unfollowed analytics event.
        // `isFollowing` here is a computed property reading FollowManager
        // — no local @State to keep in sync. Previously CreatorProfileView
        // held its own @State and could diverge from FollowManager on
        // a fetch-but-not-mutation failure.
        FollowManager.shared.toggle(
            pubId,
            name: displayName,
            avatarUrl: displayAvatarUrl,
            category: displayCategory,
            userId: appViewModel.currentUser?.id,
            sourceArticleId: nil
        )

        // Refresh canonical follower count from the server. This is purely
        // informational — FollowManager has already handled the mutation.
        // If the fetch fails we leave followerCount at the optimistic value;
        // the next loadPublisherData call will fix it.
        guard let userId = appViewModel.currentUser?.id else { return }
        Task {
            if let response = try? await publisherService.fetchPublisher(id: pubId, userId: userId) {
                followerCount = response.publisher.followerCount
            }
        }
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        VStack(spacing: 14) {
            // Avatar — real photo or letter fallback
            if let urlString = displayAvatarUrl ?? creator.avatarUrl,
               let url = URL(string: urlString) {
                AsyncCachedImage(url: url, contentMode: .fill)
                    .frame(width: 88, height: 88)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(.separator, lineWidth: 0.5))
            } else {
                Text(String((displayName.isEmpty ? creator.name : displayName).prefix(1)).uppercased())
                    .font(.system(size: 32, weight: .heavy))
                    .foregroundStyle(.white)
                    .frame(width: 88, height: 88)
                    .background(logoColor.gradient)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(.separator, lineWidth: 0.5))
            }

            VStack(spacing: 4) {
                HStack(spacing: 6) {
                    Text(displayName.isEmpty ? creator.name : displayName)
                        .font(.system(size: 20, weight: .bold))

                    if displayIsVerified {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(.blue)
                    }
                }

                Text("@\(displayUsername.isEmpty ? creator.username : displayUsername)")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)
            }

        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Stats

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(value: formatCount(articleCount), label: "Published")
            statItem(value: formatCount(followerCount), label: "Followers")
            statItem(value: formatCount(followingCount), label: "Following")
        }
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 10) {
            Button {
                if publisherId != nil {
                    toggleFollow()
                } else {
                    // Sample-creator demo path — no real publisherId to
                    // hit the API with. Use the local creator id so the
                    // entry still appears on the Following list.
                    FollowManager.shared.toggle(
                        creator.id,
                        name: displayName.isEmpty ? creator.name : displayName,
                        avatarUrl: displayAvatarUrl ?? creator.avatarUrl,
                        category: displayCategory ?? creator.category,
                        userId: appViewModel.currentUser?.id,
                        sourceArticleId: nil
                    )
                    HapticManager.medium()
                }
            } label: {
                Text(isFollowing ? "Following" : "Follow")
                    .font(.system(size: 15, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(isFollowing ? AnyShapeStyle(.fill.tertiary) : AnyShapeStyle(Color.accentColor))
                    }
                    .overlay {
                        if isFollowing {
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(.separator, lineWidth: 0.5)
                        }
                    }
            }
            .buttonStyle(.plain)

            ShareLink(
                item: URL(string: "https://tennews.ai/@\(displayUsername.isEmpty ? creator.username : displayUsername)")!,
                subject: Text(displayName.isEmpty ? creator.name : displayName)
            ) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(.separator, lineWidth: 0.5)
                    )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Published Articles

    private var publishedSection: some View {
        let allArticles = publisherId != nil ? publisherArticles : articles

        return VStack(alignment: .leading, spacing: 14) {
            Text("Published")
                .font(.system(size: 16, weight: .bold))
                .padding(.horizontal, 20)

            Divider().padding(.horizontal, 20)

            if allArticles.isEmpty && !isLoadingArticles {
                VStack(spacing: 8) {
                    Image(systemName: "newspaper")
                        .font(.system(size: 32))
                        .foregroundStyle(.quaternary)
                    Text("No published articles yet")
                        .font(.system(size: 14))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 40)
            } else if isLoadingArticles && allArticles.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40)
            } else {
                // Full feed-card layout — same component the For You
                // feed uses (header + photo + title + bullets + action
                // row). Vertical list with the feed's 24pt breathing
                // room, replacing the 2-column SearchResultCard grid.
                LazyVStack(spacing: 24) {
                    ForEach(allArticles) { article in
                        // No outer Button wrap — that swallowed the inline
                        // heart / save / share taps and bounced the user
                        // back to their own Liked tab. Now the card opens
                        // the overlay via `onTap` (fires on title/bullet
                        // area only), and the action buttons keep working.
                        ArticleCardContinuousView(
                            article: article,
                            accentColor: feedViewModel.accentColor(for: article),
                            showTopicTags: false,
                            onTap: { onArticleTap?(article) }
                        )
                    }
                }
                .padding(.top, 4)
            }
        }
    }

    // MARK: - Helpers

    private func formatCount(_ count: Int) -> String {
        if count >= 1_000_000 { return String(format: "%.1fM", Double(count) / 1_000_000) }
        if count >= 1_000 { return String(format: "%.1fK", Double(count) / 1_000) }
        return "\(count)"
    }
}
