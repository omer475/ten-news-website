import SwiftUI

struct ShareArticleSheet: View {
    let article: Article
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var chatService = ChatService.shared
    @State private var selectedFriend: ChatUser?
    @State private var sentTo: Set<String> = []

    private var userId: String? { appViewModel.currentUser?.id }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Friends grid
                if chatService.conversations.isEmpty {
                    emptyFriends
                } else {
                    friendsGrid
                        .padding(.top, 8)
                }

                Spacer(minLength: 0)

                // Bottom buttons
                VStack(spacing: 10) {
                    // Send button — visible when a friend is selected
                    if let friend = selectedFriend {
                        let isSent = sentTo.contains(friend.id)
                        Button {
                            if !isSent { sendToFriend(friend) }
                        } label: {
                            HStack(spacing: 8) {
                                if isSent {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 14, weight: .bold))
                                    Text("Sent to \(friend.name)")
                                        .font(.system(size: 15, weight: .semibold))
                                } else {
                                    Image(systemName: "paperplane.fill")
                                        .font(.system(size: 14, weight: .medium))
                                    Text("Send to \(friend.name)")
                                        .font(.system(size: 15, weight: .semibold))
                                }
                            }
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(
                                isSent ? Color.green : Color.green,
                                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                            )
                        }
                        .disabled(isSent)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }

                    // External share
                    Button {
                        shareExternal()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 14, weight: .medium))
                            Text("More options")
                                .font(.system(size: 14, weight: .medium))
                        }
                        .foregroundStyle(.white.opacity(0.5))
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .animation(.spring(response: 0.3, dampingFraction: 0.85), value: selectedFriend?.id)
            }
            .navigationTitle("Send to")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.fraction(0.4)])
        .presentationDragIndicator(.visible)
        .onAppear {
            if let uid = userId {
                Task { await chatService.loadConversations(userId: uid) }
            }
        }
    }

    // MARK: - Friends Grid

    private var friendsGrid: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 20) {
                ForEach(chatService.conversations) { conv in
                    if let other = conv.otherParticipant {
                        friendCell(user: other)
                    }
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func friendCell(user: ChatUser) -> some View {
        let isSelected = selectedFriend?.id == user.id
        let isSent = sentTo.contains(user.id)

        return Button {
            if !isSent {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                    selectedFriend = isSelected ? nil : user
                }
                HapticManager.selection()
            }
        } label: {
            VStack(spacing: 8) {
                ZStack {
                    // Selection ring
                    Circle()
                        .strokeBorder(
                            isSent ? Color.green : (isSelected ? Color.green : Color.clear),
                            lineWidth: 2.5
                        )
                        .frame(width: 62, height: 62)

                    if let avatar = user.avatar {
                        AsyncCachedImage(url: avatar, contentMode: .fill)
                            .frame(width: 56, height: 56)
                            .clipShape(Circle())
                    } else {
                        Circle()
                            .fill(.fill.tertiary)
                            .frame(width: 56, height: 56)
                            .overlay {
                                Text(String(user.name.prefix(1)).uppercased())
                                    .font(.system(size: 22, weight: .semibold))
                                    .foregroundStyle(.secondary)
                            }
                    }

                    // Sent checkmark
                    if isSent {
                        Circle()
                            .fill(.green)
                            .frame(width: 22, height: 22)
                            .overlay {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                            .offset(x: 20, y: 20)
                            .transition(.scale.combined(with: .opacity))
                    }
                }

                Text(user.name.components(separatedBy: " ").first ?? user.name)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(isSent ? .secondary : .primary)
                    .lineLimit(1)
            }
            .frame(width: 72)
        }
        .buttonStyle(.plain)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSent)
    }

    private func sendToFriend(_ user: ChatUser) {
        guard let uid = userId, let articleId = Int(article.id.stringValue) else { return }
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            sentTo.insert(user.id)
            selectedFriend = nil
        }
        HapticManager.success()

        Task {
            let success = await chatService.shareArticle(fromUserId: uid, toUserId: user.id, articleId: articleId)
            if !success {
                withAnimation { sentTo.remove(user.id) }
                HapticManager.error()
            } else {
                try? await Task.sleep(nanoseconds: 150_000_000)
                dismiss()
            }
        }
    }

    // MARK: - Empty State

    private var emptyFriends: some View {
        VStack(spacing: 10) {
            Image(systemName: "person.2")
                .font(.system(size: 28))
                .foregroundStyle(.quaternary)
            Text("No recent chats")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.secondary)
            Text("Start a conversation to share articles")
                .font(.system(size: 12))
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }

    // MARK: - External Share

    private func shareExternal() {
        let title = article.displayTitle
        let url = article.url ?? "https://tennews.ai"
        let items: [Any] = ["\(title)\n\(url)"]
        let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first,
           let rootVC = window.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }
}
