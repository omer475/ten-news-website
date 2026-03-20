import SwiftUI

struct ChatListView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var chatService = ChatService.shared
    @State private var showNewChat = false
    @State private var selectedConversation: ChatConversation?

    private var userId: String? { appViewModel.currentUser?.id }

    var body: some View {
        NavigationStack {
            Group {
                if appViewModel.isGuest {
                    guestPrompt
                } else if chatService.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if chatService.conversations.isEmpty {
                    emptyState
                } else {
                    conversationList
                }
            }
            .navigationTitle("Messages")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                if !appViewModel.isGuest {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showNewChat = true
                            HapticManager.light()
                        } label: {
                            Image(systemName: "square.and.pencil")
                                .font(.system(size: 18, weight: .medium))
                        }
                    }
                }
            }
            .background(Theme.Colors.backgroundPrimary)
            .refreshable {
                if let uid = userId {
                    await chatService.loadConversations(userId: uid)
                }
            }
        }
        .sheet(isPresented: $showNewChat) {
            NewChatView { conversation in
                showNewChat = false
                selectedConversation = conversation
            }
        }
        .fullScreenCover(item: $selectedConversation) { conversation in
            ChatDetailView(conversation: conversation, onDismiss: {
                selectedConversation = nil
            })
        }
        .onAppear {
            if let uid = userId {
                Task { await chatService.loadConversations(userId: uid) }
            }
        }
    }

    // MARK: - Conversation List

    private var conversationList: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: 0) {
                ForEach(chatService.conversations) { conversation in
                    Button {
                        selectedConversation = conversation
                        HapticManager.selection()
                    } label: {
                        conversationRow(conversation)
                    }
                    .buttonStyle(.plain)

                    if conversation.id != chatService.conversations.last?.id {
                        Divider().padding(.leading, 80)
                    }
                }
            }
            .padding(.bottom, 100)
        }
    }

    private func conversationRow(_ conversation: ChatConversation) -> some View {
        HStack(spacing: 14) {
            // Avatar
            if let avatarUrl = conversation.displayAvatar {
                AsyncCachedImage(url: avatarUrl, contentMode: .fill)
                    .frame(width: 56, height: 56)
                    .clipShape(Circle())
            } else {
                Circle()
                    .fill(.fill.tertiary)
                    .frame(width: 56, height: 56)
                    .overlay {
                        Text(String(conversation.displayName.prefix(1)).uppercased())
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.displayName)
                        .font(.system(size: 16, weight: .semibold))
                        .lineLimit(1)
                    Spacer()
                    Text(conversation.lastMessageTime)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }

                Text(conversation.lastMessagePreview)
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    // MARK: - Empty & Guest States

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(.quaternary)
            Text("No Messages")
                .font(.system(size: 18, weight: .semibold))
            Text("Share articles with friends and start a conversation.")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button {
                showNewChat = true
                HapticManager.light()
            } label: {
                Text("New Message")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(.blue, in: Capsule())
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }

    private var guestPrompt: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(.quaternary)
            Text("Create Account to Message")
                .font(.system(size: 18, weight: .semibold))
            Text("Create an account to share articles and chat with friends.")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }
}
