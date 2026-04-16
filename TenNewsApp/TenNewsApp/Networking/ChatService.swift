import Foundation

/// Handles chat API calls and message polling.
@MainActor @Observable
final class ChatService {
    static let shared = ChatService()

    private(set) var conversations: [ChatConversation] = []
    private(set) var isLoading = false
    private(set) var unreadCount: Int = 0

    private var pollTimer: Timer?
    private var currentUserId: String?

    private init() {}

    // MARK: - Conversations

    func loadConversations(userId: String) async {
        currentUserId = userId
        isLoading = conversations.isEmpty
        do {
            let response: ConversationsResponse = try await APIClient.shared.get(
                "/api/chat/conversations?user_id=\(userId)"
            )
            conversations = response.conversations
            // Count unread: conversations where last message is from someone else and unread
            unreadCount = conversations.filter { conv in
                guard let lastMsg = conv.lastMessage else { return false }
                return lastMsg.senderId != userId && lastMsg.readAt == nil
            }.count
        } catch {
            print("Chat: load conversations error: \(error)")
        }
        isLoading = false
    }

    /// Send an article to a friend — uses cached conversation if available, otherwise creates one
    func shareArticle(fromUserId: String, toUserId: String, articleId: Int) async -> Bool {
        // Try to find existing conversation locally first (skip API call)
        let existingConv = conversations.first { conv in
            conv.participants.contains(where: { $0.id == toUserId })
        }

        let conversationId: String
        if let existing = existingConv {
            conversationId = existing.id
        } else {
            guard let created = await createOrFindConversation(userId: fromUserId, otherUserId: toUserId) else {
                return false
            }
            conversationId = created.id
        }

        let message = await sendMessage(conversationId: conversationId, senderId: fromUserId, content: nil, articleId: articleId)
        if message != nil {
            // Refresh conversations in background (don't block)
            Task { await loadConversations(userId: fromUserId) }
        }
        return message != nil
    }

    /// Get recent chat contacts for the share sheet
    func recentContacts(userId: String) -> [ChatUser] {
        // Return other participants from conversations, sorted by most recent
        return conversations.compactMap { $0.otherParticipant }.prefix(10).map { $0 }
    }

    func createOrFindConversation(userId: String, otherUserId: String) async -> ChatConversation? {
        do {
            let body = CreateConversationRequest(userId: userId, otherUserId: otherUserId)
            let response: CreateConversationResponse = try await APIClient.shared.post(
                "/api/chat/conversations", body: body
            )
            // Refresh conversation list
            await loadConversations(userId: userId)
            return response.conversation
        } catch {
            print("Chat: create conversation error: \(error)")
            return nil
        }
    }

    // MARK: - Messages

    func loadMessages(conversationId: String) async -> [ChatMessage] {
        do {
            let response: MessagesResponse = try await APIClient.shared.get(
                "/api/chat/conversations/\(conversationId)/messages"
            )
            return response.messages
        } catch {
            print("Chat: load messages error: \(error)")
            return []
        }
    }

    func sendMessage(conversationId: String, senderId: String, content: String?, articleId: Int? = nil) async -> ChatMessage? {
        do {
            let body = SendMessageRequest(senderId: senderId, content: content, articleId: articleId)
            let response: SendMessageResponse = try await APIClient.shared.post(
                "/api/chat/conversations/\(conversationId)/messages", body: body
            )
            return response.message
        } catch {
            print("Chat: send message error: \(error)")
            return nil
        }
    }

    // MARK: - User Search

    func searchUsers(query: String, currentUserId: String) async -> [ChatUser] {
        guard query.count >= 2 else { return [] }
        do {
            let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
            let response: UserSearchResponse = try await APIClient.shared.get(
                "/api/chat/users/search?q=\(encoded)&user_id=\(currentUserId)"
            )
            return response.users
        } catch {
            print("Chat: search users error: \(error)")
            return []
        }
    }

    // MARK: - Polling

    func startPolling(conversationId: String, onNewMessages: @escaping ([ChatMessage]) -> Void) {
        stopPolling()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                let messages = await self.loadMessages(conversationId: conversationId)
                onNewMessages(messages)
            }
        }
    }

    func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
    }
}
