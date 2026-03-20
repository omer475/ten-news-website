import SwiftUI

struct ChatDetailView: View {
    @Environment(AppViewModel.self) private var appViewModel

    let conversation: ChatConversation
    var onDismiss: (() -> Void)?

    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = true
    @State private var chatService = ChatService.shared
    @FocusState private var inputFocused: Bool

    private var userId: String? { appViewModel.currentUser?.id }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Messages
                ScrollViewReader { proxy in
                    ScrollView(.vertical, showsIndicators: false) {
                        LazyVStack(spacing: 4) {
                            if isLoading {
                                ProgressView()
                                    .padding(.top, 40)
                            }
                            ForEach(messages) { message in
                                messageBubble(message)
                                    .id(message.id)
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.top, 12)
                        .padding(.bottom, 8)
                    }
                    .onChange(of: messages.count) { _, _ in
                        if let last = messages.last {
                            withAnimation(.easeOut(duration: 0.2)) {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                }

                Divider()

                // Input bar
                inputBar
            }
            .navigationTitle(conversation.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        onDismiss?()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                    }
                }
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        if let avatarUrl = conversation.displayAvatar {
                            AsyncCachedImage(url: avatarUrl, contentMode: .fill)
                                .frame(width: 28, height: 28)
                                .clipShape(Circle())
                        }
                        Text(conversation.displayName)
                            .font(.system(size: 16, weight: .semibold))
                    }
                }
            }
            .background(Theme.Colors.backgroundPrimary)
        }
        .onAppear {
            Task {
                messages = await chatService.loadMessages(conversationId: conversation.id)
                isLoading = false
            }
            // Start polling for new messages
            chatService.startPolling(conversationId: conversation.id) { newMessages in
                if newMessages.count != messages.count || newMessages.last?.id != messages.last?.id {
                    messages = newMessages
                }
            }
        }
        .onDisappear {
            chatService.stopPolling()
            // Refresh conversation list
            if let uid = userId {
                Task { await chatService.loadConversations(userId: uid) }
            }
        }
    }

    // MARK: - Message Bubble

    private func messageBubble(_ message: ChatMessage) -> some View {
        let isMe = message.senderId == userId

        return HStack {
            if isMe { Spacer(minLength: 60) }

            VStack(alignment: isMe ? .trailing : .leading, spacing: 4) {
                // Article share card
                if message.isArticleShare, let article = message.article {
                    articleCard(article)
                }

                // Text content
                if let content = message.content, !content.isEmpty {
                    Text(content)
                        .font(.system(size: 16))
                        .foregroundStyle(isMe ? .white : .primary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            isMe ? Color.blue : Color(.systemGray5),
                            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                        )
                }

                // Timestamp
                Text(message.timeString)
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 4)
            }

            if !isMe { Spacer(minLength: 60) }
        }
        .padding(.vertical, 2)
    }

    private func articleCard(_ article: SharedArticle) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let imageUrl = article.displayImage {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(height: 120)
                    .clipped()
            }

            VStack(alignment: .leading, spacing: 4) {
                if let title = article.title {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(2)
                }

                HStack(spacing: 6) {
                    if let source = article.source {
                        Text(source)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    if let category = article.category {
                        Text(category)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.blue)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(.blue.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(10)
        }
        .frame(width: 220)
        .background(.fill.tertiary)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Message...", text: $inputText, axis: .vertical)
                .font(.system(size: 16))
                .lineLimit(1...5)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(.fill.tertiary, in: Capsule())
                .focused($inputFocused)

            Button {
                sendMessage()
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color.gray.opacity(0.3) : Color.blue)
            }
            .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.bar)
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let uid = userId else { return }

        inputText = ""
        HapticManager.light()

        Task {
            if let sent = await chatService.sendMessage(
                conversationId: conversation.id,
                senderId: uid,
                content: text
            ) {
                messages.append(sent)
            }
        }
    }
}
