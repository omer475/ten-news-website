import Foundation

/// Handles chat API calls and message polling.
@MainActor @Observable
final class ChatService {
    static let shared = ChatService()

    private(set) var conversations: [ChatConversation] = []
    private(set) var isLoading = false

    private var pollTimer: Timer?

    private init() {}

    // MARK: - Conversations

    func loadConversations(userId: String) async {
        isLoading = conversations.isEmpty
        do {
            let response: ConversationsResponse = try await APIClient.shared.get(
                "/api/chat/conversations?user_id=\(userId)"
            )
            conversations = response.conversations
        } catch {
            print("Chat: load conversations error: \(error)")
        }
        isLoading = false
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
