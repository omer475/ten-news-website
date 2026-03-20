import Foundation

// MARK: - Conversation

struct ChatConversation: Codable, Identifiable {
    let id: String
    let participants: [ChatUser]
    let lastMessage: ChatMessage?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, participants
        case lastMessage = "last_message"
        case updatedAt = "updated_at"
    }

    var otherParticipant: ChatUser? {
        participants.first
    }

    var displayName: String {
        otherParticipant?.displayName ?? "Unknown"
    }

    var displayAvatar: URL? {
        guard let urlString = otherParticipant?.avatarUrl, !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }

    var lastMessagePreview: String {
        if let msg = lastMessage {
            if msg.articleId != nil { return "Shared an article" }
            return msg.content ?? ""
        }
        return "No messages yet"
    }

    var lastMessageTime: String {
        guard let dateStr = lastMessage?.createdAt ?? updatedAt else { return "" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: dateStr) ?? ISO8601DateFormatter().date(from: dateStr) else { return "" }
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        if interval < 604800 { return "\(Int(interval / 86400))d" }
        let df = DateFormatter()
        df.dateFormat = "MMM d"
        return df.string(from: date)
    }
}

// MARK: - Chat User

struct ChatUser: Codable, Identifiable, Hashable {
    let id: String
    let displayName: String?
    let avatarUrl: String?
    let email: String?

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case email
    }

    var name: String { displayName ?? email ?? "User" }

    var avatar: URL? {
        guard let urlString = avatarUrl, !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }
}

// MARK: - Message

struct ChatMessage: Codable, Identifiable, Equatable {
    let id: String
    let conversationId: String
    let senderId: String
    let content: String?
    let articleId: Int?
    let article: SharedArticle?
    let createdAt: String
    let readAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case conversationId = "conversation_id"
        case senderId = "sender_id"
        case content
        case articleId = "article_id"
        case article
        case createdAt = "created_at"
        case readAt = "read_at"
    }

    var isArticleShare: Bool { articleId != nil }

    var timeString: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: createdAt) ?? ISO8601DateFormatter().date(from: createdAt) else { return "" }
        let df = DateFormatter()
        df.dateFormat = "h:mm a"
        return df.string(from: date)
    }

    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Shared Article (lightweight article data in messages)

struct SharedArticle: Codable {
    let id: Int
    let title: String?
    let imageUrl: String?
    let source: String?
    let category: String?

    enum CodingKeys: String, CodingKey {
        case id, title, source, category
        case imageUrl = "image_url"
    }

    var displayImage: URL? {
        guard let urlString = imageUrl, !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }
}

// MARK: - API Request/Response

struct ConversationsResponse: Codable {
    let conversations: [ChatConversation]
}

struct MessagesResponse: Codable {
    let messages: [ChatMessage]
}

struct SendMessageRequest: Codable {
    let senderId: String
    let content: String?
    let articleId: Int?

    enum CodingKeys: String, CodingKey {
        case senderId = "sender_id"
        case content
        case articleId = "article_id"
    }
}

struct SendMessageResponse: Codable {
    let message: ChatMessage
}

struct CreateConversationRequest: Codable {
    let userId: String
    let otherUserId: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case otherUserId = "other_user_id"
    }
}

struct CreateConversationResponse: Codable {
    let conversation: ChatConversation
}

struct UserSearchResponse: Codable {
    let users: [ChatUser]
}
