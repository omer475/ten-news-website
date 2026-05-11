import SwiftUI

/// Sheet shown when the user taps the "Following" stat on AccountTabView.
/// Lists every publisher they currently follow, with a tap-to-profile +
/// unfollow affordance per row. Source of truth: FollowManager.shared —
/// edits here propagate to every follow surface (card chip, profile button)
/// because they all share the same @Observable singleton.
struct FollowingListView: View {
    let onDismiss: () -> Void

    @State private var followManager = FollowManager.shared
    @State private var selectedPublisher: FollowedPublisher?
    @Environment(AppViewModel.self) private var appViewModel

    var body: some View {
        NavigationStack {
            Group {
                if followManager.followedPublishers.isEmpty {
                    emptyState
                } else {
                    publisherList
                }
            }
            .navigationTitle("Following")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { onDismiss() }
                }
            }
            .background(Theme.Colors.backgroundPrimary)
        }
        .fullScreenCover(item: $selectedPublisher) { pub in
            CreatorProfileView(
                creator: SampleCreators.find(bySource: pub.name),
                articles: [],
                onDismiss: { selectedPublisher = nil },
                publisherId: pub.id
            )
        }
    }

    // MARK: - List

    private var publisherList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(followManager.followedPublishers) { pub in
                    Button {
                        selectedPublisher = pub
                        HapticManager.selection()
                    } label: {
                        row(pub)
                    }
                    .buttonStyle(.plain)

                    if pub.id != followManager.followedPublishers.last?.id {
                        Divider().padding(.leading, 76)
                    }
                }
            }
            .padding(.vertical, 8)
        }
    }

    private func row(_ pub: FollowedPublisher) -> some View {
        HStack(spacing: 14) {
            avatar(for: pub)

            VStack(alignment: .leading, spacing: 2) {
                Text(pub.name)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Colors.primaryText)
                    .lineLimit(1)

                if let category = pub.category, !category.isEmpty {
                    Text(category)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Colors.secondaryText)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            unfollowButton(for: pub)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private func avatar(for pub: FollowedPublisher) -> some View {
        let colors: [Color] = [.blue, .purple, .pink, .orange, .teal, .indigo, .mint, .cyan]
        let color = colors[abs(pub.id.hashValue) % colors.count]
        if let urlString = pub.avatarUrl, let url = URL(string: urlString) {
            AsyncCachedImage(url: url, contentMode: .fill)
                .frame(width: 44, height: 44)
                .clipShape(Circle())
                .overlay(Circle().stroke(.separator, lineWidth: 0.5))
        } else {
            Circle()
                .fill(color)
                .frame(width: 44, height: 44)
                .overlay(
                    Text(String(pub.name.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased())
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                )
                .overlay(Circle().stroke(.separator, lineWidth: 0.5))
        }
    }

    private func unfollowButton(for pub: FollowedPublisher) -> some View {
        Button {
            // Toggle off — FollowManager handles persistence, analytics, and
            // the server unfollow call. The row disappears from the list
            // automatically because @Observable notifies the ForEach.
            FollowManager.shared.toggle(
                pub.id,
                name: pub.name,
                avatarUrl: pub.avatarUrl,
                category: pub.category,
                userId: appViewModel.currentUser?.id,
                sourceArticleId: nil
            )
            HapticManager.medium()
        } label: {
            Text("Following")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.primaryText)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(.fill.tertiary, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.2")
                .font(.system(size: 36))
                .foregroundStyle(.quaternary)
            Text("Not following anyone yet")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Colors.primaryText)
            Text("Tap + on any creator's profile or article card to follow them.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
