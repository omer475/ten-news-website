import SwiftUI

/// Generic list-of-users surface, used for three flows on the Account tab:
///   - Followers (people who follow the current user)
///   - Following (people the current user follows)
///   - Search results from the "Find people" sheet
///
/// Rows tap into UserProfileView. The "Following" pill on each row toggles
/// the follow state via UserFollowManager — same source of truth across
/// every social surface in the app.
struct UserListView: View {
    enum Mode {
        case followers(userId: String)
        case following(userId: String)
        case search

        var title: String {
            switch self {
            case .followers: return "Followers"
            case .following: return "Following"
            case .search:    return "Find people"
            }
        }
    }

    let mode: Mode
    let onDismiss: () -> Void

    @State private var users: [SocialProfile] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var searchQuery: String = ""
    @State private var searchTask: Task<Void, Never>?
    @State private var selectedUser: SocialProfile?
    @State private var followManager = UserFollowManager.shared

    @Environment(AppViewModel.self) private var appViewModel
    private let service = UserService()

    var body: some View {
        NavigationStack {
            Group {
                if case .search = mode {
                    searchContent
                } else {
                    listContent
                }
            }
            .navigationTitle(mode.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { onDismiss() }
                }
            }
            .background(Theme.Colors.backgroundPrimary)
            .task { await load() }
        }
        .fullScreenCover(item: $selectedUser) { profile in
            UserProfileView(profile: profile, onDismiss: { selectedUser = nil })
        }
    }

    // MARK: - List + search content

    @ViewBuilder
    private var listContent: some View {
        if isLoading && users.isEmpty {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if users.isEmpty {
            emptyState
        } else {
            userScroll
        }
    }

    private var searchContent: some View {
        VStack(spacing: 0) {
            searchField
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            if isLoading && users.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if searchQuery.trimmingCharacters(in: .whitespaces).count < 2 {
                emptyState
            } else if users.isEmpty {
                emptyState
            } else {
                userScroll
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Username or name", text: $searchQuery)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .onChange(of: searchQuery) { _, newValue in
                    debounceSearch(newValue)
                }
            if !searchQuery.isEmpty {
                Button {
                    searchQuery = ""
                    users = []
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.fill.tertiary, in: Capsule())
    }

    private var userScroll: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(users) { profile in
                    Button {
                        selectedUser = profile
                        HapticManager.selection()
                    } label: {
                        row(profile)
                    }
                    .buttonStyle(.plain)
                    if profile.id != users.last?.id {
                        Divider().padding(.leading, 76)
                    }
                }
            }
            .padding(.vertical, 8)
        }
    }

    // MARK: - Row

    private func row(_ profile: SocialProfile) -> some View {
        HStack(spacing: 14) {
            avatar(for: profile)
            VStack(alignment: .leading, spacing: 2) {
                Text(profile.renderedName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Colors.primaryText)
                    .lineLimit(1)
                if let u = profile.username, !u.isEmpty, profile.renderedName != u {
                    Text("@\(u)")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Colors.secondaryText)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if profile.id != appViewModel.currentUser?.id {
                followPill(for: profile)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private func avatar(for profile: SocialProfile) -> some View {
        let colors: [Color] = [.blue, .purple, .pink, .orange, .teal, .indigo, .mint, .cyan]
        let color = colors[abs(profile.id.hashValue) % colors.count]
        if let urlString = profile.avatarUrl, let url = URL(string: urlString) {
            AsyncCachedImage(url: url, contentMode: .fill)
                .frame(width: 44, height: 44)
                .clipShape(Circle())
                .overlay(Circle().stroke(.separator, lineWidth: 0.5))
        } else {
            Circle()
                .fill(color)
                .frame(width: 44, height: 44)
                .overlay(
                    Text(String(profile.renderedName.prefix(1)).uppercased())
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                )
                .overlay(Circle().stroke(.separator, lineWidth: 0.5))
        }
    }

    private func followPill(for profile: SocialProfile) -> some View {
        let isFollowing = followManager.isFollowing(profile.id)
        return Button {
            followManager.toggle(profile)
            HapticManager.medium()
        } label: {
            Text(isFollowing ? "Following" : "Follow")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isFollowing ? Theme.Colors.primaryText : .white)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    isFollowing
                        ? AnyShapeStyle(.fill.tertiary)
                        : AnyShapeStyle(Color.accentColor),
                    in: Capsule()
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Empty / load

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: emptyIcon)
                .font(.system(size: 36))
                .foregroundStyle(.quaternary)
            Text(emptyTitle)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Colors.primaryText)
            Text(emptySubtitle)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyIcon: String {
        switch mode {
        case .followers: return "person.2"
        case .following: return "person.crop.circle.badge.plus"
        case .search:    return "magnifyingglass"
        }
    }

    private var emptyTitle: String {
        switch mode {
        case .followers: return "No followers yet"
        case .following: return "Not following anyone yet"
        case .search:    return searchQuery.count < 2 ? "Type to search" : "No people found"
        }
    }

    private var emptySubtitle: String {
        switch mode {
        case .followers:
            return "When people follow you, you'll see them here."
        case .following:
            return "Use \"Find people\" to discover users and tap Follow on their profile."
        case .search:
            return searchQuery.count < 2
                ? "Search people by username or display name."
                : "Try a different spelling."
        }
    }

    // MARK: - Loaders

    private func load() async {
        guard !isLoading else { return }
        switch mode {
        case .followers(let userId):
            isLoading = true
            defer { isLoading = false }
            if let resp = try? await service.fetchUserFollowers(userId: userId, limit: 100) {
                users = resp.users
            }
        case .following(let userId):
            isLoading = true
            defer { isLoading = false }
            if let resp = try? await service.fetchUserFollowing(userId: userId, limit: 100) {
                users = resp.users
            }
        case .search:
            // Search is debounced from the text field. Initial load is a no-op.
            break
        }
    }

    private func debounceSearch(_ value: String) {
        searchTask?.cancel()
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else {
            users = []
            return
        }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            if Task.isCancelled { return }
            isLoading = true
            defer { isLoading = false }
            let viewerId = appViewModel.currentUser?.id
            if let resp = try? await service.searchUsers(query: trimmed, excludeId: viewerId) {
                if !Task.isCancelled {
                    users = resp.users
                }
            }
        }
    }
}
