import SwiftUI

/// Profile page for ANOTHER user (not the current user). Shows their avatar,
/// display name, follower / following counts, and a Follow / Following pill
/// wired to UserFollowManager. Opened from:
///   - UserListView rows (followers / following / search)
///
/// Distinct from CreatorProfileView (which is for publishers, backed by the
/// publishers table). Users live in profiles + user_user_follows.
struct UserProfileView: View {
    let profile: SocialProfile
    let onDismiss: () -> Void

    @State private var displayProfile: SocialProfile
    @State private var followerCount: Int = 0
    @State private var followingCount: Int = 0
    @State private var hasLoaded = false
    @State private var followManager = UserFollowManager.shared
    @Environment(AppViewModel.self) private var appViewModel

    private let service = UserService()

    init(profile: SocialProfile, onDismiss: @escaping () -> Void) {
        self.profile = profile
        self.onDismiss = onDismiss
        _displayProfile = State(initialValue: profile)
    }

    private var isMe: Bool {
        appViewModel.currentUser?.id == profile.id
    }

    private var isFollowing: Bool {
        followManager.isFollowing(profile.id)
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 20) {
                    Spacer().frame(height: 70)
                    avatar
                    Text(displayProfile.renderedName)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.Colors.primaryText)
                    if let u = displayProfile.username, !u.isEmpty {
                        Text("@\(u)")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.Colors.secondaryText)
                    }
                    statsRow
                        .padding(.top, 6)
                    if !isMe {
                        followButton
                            .padding(.horizontal, 32)
                            .padding(.top, 6)
                    }
                    Spacer(minLength: 80)
                }
                .frame(maxWidth: .infinity)
            }
            backButton
        }
        .background(Theme.Colors.backgroundPrimary.ignoresSafeArea())
        .ignoresSafeArea()
        .swipeToDismiss { onDismiss() }
        .task { await load() }
    }

    private var avatar: some View {
        let colors: [Color] = [.blue, .purple, .pink, .orange, .teal, .indigo, .mint, .cyan]
        let color = colors[abs(displayProfile.id.hashValue) % colors.count]
        return Group {
            if let urlString = displayProfile.avatarUrl, let url = URL(string: urlString) {
                AsyncCachedImage(url: url, contentMode: .fill)
                    .frame(width: 96, height: 96)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(.separator, lineWidth: 0.5))
            } else {
                Circle()
                    .fill(color)
                    .frame(width: 96, height: 96)
                    .overlay(
                        Text(String(displayProfile.renderedName.prefix(1)).uppercased())
                            .font(.system(size: 36, weight: .bold))
                            .foregroundStyle(.white)
                    )
                    .overlay(Circle().stroke(.separator, lineWidth: 0.5))
            }
        }
    }

    private var statsRow: some View {
        HStack(spacing: 40) {
            statItem(value: "\(followerCount)", label: "Followers")
            statItem(value: "\(followingCount)", label: "Following")
        }
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Colors.primaryText)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Colors.secondaryText)
        }
    }

    private var followButton: some View {
        Button {
            let willFollow = !isFollowing
            followerCount += willFollow ? 1 : -1
            followManager.toggle(displayProfile)
            HapticManager.medium()
        } label: {
            Text(isFollowing ? "Following" : "Follow")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(isFollowing ? Theme.Colors.primaryText : .white)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(
                    isFollowing
                        ? AnyShapeStyle(.fill.tertiary)
                        : AnyShapeStyle(Color.accentColor),
                    in: RoundedRectangle(cornerRadius: 22, style: .continuous)
                )
        }
        .buttonStyle(.plain)
    }

    private var backButton: some View {
        Button {
            onDismiss()
        } label: {
            Image(systemName: "chevron.left")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Colors.primaryText)
                .frame(width: 38, height: 38)
                .background(.regularMaterial, in: Circle())
        }
        .padding(.top, 56)
        .padding(.leading, 20)
    }

    // MARK: - Load

    private func load() async {
        guard !hasLoaded else { return }
        hasLoaded = true
        let viewerId = appViewModel.currentUser?.id
        if let resp = try? await service.fetchUserProfile(userId: profile.id, viewerId: viewerId) {
            displayProfile = resp.profile
            followerCount = resp.followerCount
            followingCount = resp.followingCount
            if let serverFollowing = resp.isFollowing {
                followManager.syncFromServer(profile: resp.profile, isFollowing: serverFollowing)
            }
        }
    }
}
