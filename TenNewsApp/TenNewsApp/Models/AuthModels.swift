import Foundation

// MARK: - Login

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let success: Bool?
    let user: AuthUser?
    let session: AuthSession?
    let message: String?
    let error: String?
}

// MARK: - Signup

struct SignupRequest: Codable {
    let email: String
    let password: String
    let name: String?
}

struct SignupResponse: Codable {
    let success: Bool?
    let user: AuthUser?
    let session: AuthSession?
    let message: String?
    let error: String?
}

// MARK: - Forgot Password

struct ForgotPasswordRequest: Codable {
    let email: String
}

struct ForgotPasswordResponse: Codable {
    let success: Bool?
    let message: String?
    let error: String?
}

// MARK: - Auth User

struct AuthUser: Codable, Identifiable, Hashable {
    let id: String
    let email: String?
    let name: String?
    let avatarUrl: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, email, name
        case avatarUrl = "avatar_url"
        case createdAt = "created_at"
    }

    var displayName: String { name ?? email ?? "User" }

    var displayAvatar: URL? {
        guard let urlString = avatarUrl, !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }
}

// MARK: - User Profile

struct UserProfile: Codable, Hashable {
    let id: String?
    let email: String?
    let name: String?
    let avatarUrl: String?
    let createdAt: String?
    let preferences: UserPreferences?

    enum CodingKeys: String, CodingKey {
        case id, email, name, preferences
        case avatarUrl = "avatar_url"
        case createdAt = "created_at"
    }

    init(id: String? = nil, email: String? = nil, name: String? = nil,
         avatarUrl: String? = nil, createdAt: String? = nil, preferences: UserPreferences? = nil) {
        self.id = id
        self.email = email
        self.name = name
        self.avatarUrl = avatarUrl
        self.createdAt = createdAt
        self.preferences = preferences
    }
}

// MARK: - Auth Session

struct AuthSession: Codable, Hashable {
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Int?
    let expiresAt: Int?
    let tokenType: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
        case tokenType = "token_type"
    }
}
