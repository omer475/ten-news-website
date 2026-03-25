import SwiftUI

struct CreatorProfileView: View {
    let creator: Creator
    let articles: [Article]
    let onDismiss: () -> Void
    var onArticleTap: ((Article) -> Void)?

    @State private var isFollowing = false

    private let logoColors: [Color] = [.blue, .purple, .pink, .orange, .teal, .indigo, .mint, .cyan]
    private var logoColor: Color {
        logoColors[abs(creator.name.hashValue) % logoColors.count]
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Header
                    profileHeader
                        .padding(.top, 70)

                    // Stats
                    statsRow
                        .padding(.top, 20)

                    // Follow / Message buttons
                    actionButtons
                        .padding(.top, 18)
                        .padding(.horizontal, 20)

                    // Bio
                    if !creator.bio.isEmpty {
                        Text(creator.bio)
                            .font(.system(size: 14))
                            .foregroundStyle(.white.opacity(0.6))
                            .multilineTextAlignment(.center)
                            .lineSpacing(3)
                            .padding(.horizontal, 32)
                            .padding(.top, 16)
                    }

                    // Articles section
                    articlesSection
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
                    .background(.white.opacity(0.1), in: Circle())
            }
            .padding(.top, 56)
            .padding(.leading, 20)
        }
        .background(Color.black.ignoresSafeArea())
        .ignoresSafeArea()
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        VStack(spacing: 12) {
            // Avatar
            Text(creator.displayInitial)
                .font(.system(size: 32, weight: .heavy))
                .foregroundStyle(.white)
                .frame(width: 88, height: 88)
                .background(logoColor.gradient)
                .clipShape(Circle())
                .overlay(
                    Circle().stroke(.white.opacity(0.15), lineWidth: 2)
                )

            // Name + verified
            HStack(spacing: 6) {
                Text(creator.name)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)

                if creator.isVerified {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(.blue)
                }
            }

            // Username
            Text("@\(creator.username)")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white.opacity(0.4))

            // Category badge
            if let category = creator.category {
                Text(category)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.6))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(.white.opacity(0.08), in: Capsule())
            }
        }
    }

    // MARK: - Stats

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(value: formatCount(creator.followerCount), label: "Followers")
            statItem(value: formatCount(creator.followingCount), label: "Following")
            statItem(value: formatCount(creator.articleCount), label: "Read")
        }
        .padding(.horizontal, 20)
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 10) {
            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isFollowing.toggle()
                }
                HapticManager.medium()
            } label: {
                Text(isFollowing ? "Following" : "Follow")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(
                        isFollowing ? Color.white.opacity(0.1) : Color.red,
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .overlay {
                        if isFollowing {
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(.white.opacity(0.15), lineWidth: 1)
                        }
                    }
            }

            Button {
                HapticManager.light()
            } label: {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(.white.opacity(0.15), lineWidth: 1)
                    )
            }
        }
    }

    // MARK: - Articles

    private var articlesSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Articles")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(articles.count)")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.4))
            }
            .padding(.horizontal, 20)

            Divider().overlay(.white.opacity(0.1))

            if articles.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "newspaper")
                        .font(.system(size: 32))
                        .foregroundStyle(.white.opacity(0.15))
                    Text("No articles yet")
                        .font(.system(size: 14))
                        .foregroundStyle(.white.opacity(0.3))
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 40)
            } else {
                // Article grid
                let screenW = UIScreen.main.bounds.width
                let hPad: CGFloat = 16
                let gap: CGFloat = 8
                let halfW = (screenW - hPad * 2 - gap) / 2

                LazyVGrid(columns: [
                    GridItem(.fixed(halfW), spacing: gap),
                    GridItem(.fixed(halfW), spacing: gap)
                ], spacing: gap) {
                    ForEach(articles) { article in
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
