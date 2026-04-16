import SwiftUI

struct CreatorProfileView: View {
    let creator: Creator
    let articles: [Article]
    let onDismiss: () -> Void
    var onArticleTap: ((Article) -> Void)?

    // Publisher data (fetched from API when publisherId is available)
    var publisherId: String?

    @State private var isFollowing = false
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

    @Environment(AppViewModel.self) private var appViewModel

    private let publisherService = PublisherService()

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

            // Back button
            Button {
                onDismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .glassEffect(.regular, in: Circle())
            }
            .padding(.top, 56)
            .padding(.leading, 20)
        }
        .background(Theme.Colors.backgroundPrimary.ignoresSafeArea())
        .ignoresSafeArea()
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
            isFollowing = response.isFollowing
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
        guard let pubId = publisherId, let userId = appViewModel.currentUser?.id else { return }

        let wasFollowing = isFollowing
        isFollowing.toggle()
        followerCount += isFollowing ? 1 : -1
        HapticManager.medium()

        Task {
            do {
                let response: FollowResponse
                if !wasFollowing {
                    response = try await publisherService.follow(publisherId: pubId, userId: userId)
                } else {
                    response = try await publisherService.unfollow(publisherId: pubId, userId: userId)
                }
                followerCount = response.followerCount
            } catch {
                isFollowing = wasFollowing
                followerCount += wasFollowing ? 1 : -1
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
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        isFollowing.toggle()
                    }
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
                let screenW = UIScreen.main.bounds.width
                let hPad: CGFloat = 16
                let gap: CGFloat = 8
                let halfW = (screenW - hPad * 2 - gap) / 2

                LazyVGrid(columns: [
                    GridItem(.fixed(halfW), spacing: gap),
                    GridItem(.fixed(halfW), spacing: gap)
                ], spacing: gap) {
                    ForEach(allArticles) { article in
                        Button {
                            onArticleTap?(article)
                        } label: {
                            SearchResultCard(
                                article: article.toSearchArticle(),
                                fallbackColor: logoColor,
                                cardWidth: halfW,
                                cardHeight: halfW * 1.35
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, hPad)
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
