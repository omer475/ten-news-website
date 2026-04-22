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
    let needsProfile: Bool?   // set true by /api/auth/google when username/DOB missing

    enum CodingKeys: String, CodingKey {
        case success, user, session, message, error
        case needsProfile = "needs_profile"
    }
}

// MARK: - Signup

struct SignupRequest: Codable {
    let email: String
    let password: String
    let name: String?
    let username: String?
    let dateOfBirth: String?   // ISO 8601 date string: "YYYY-MM-DD"

    enum CodingKeys: String, CodingKey {
        case email, password, name, username
        case dateOfBirth = "date_of_birth"
    }
}

struct SignupResponse: Codable {
    let success: Bool?
    let user: AuthUser?
    let session: AuthSession?
    let message: String?
    let error: String?
    let requiresVerification: Bool?
}

// MARK: - Complete Profile (Google OAuth follow-up)

struct CompleteProfileRequest: Codable {
    let username: String?
    let dateOfBirth: String?
    let name: String?

    enum CodingKeys: String, CodingKey {
        case username, name
        case dateOfBirth = "date_of_birth"
    }
}

struct CompleteProfileResponse: Codable {
    let success: Bool?
    let user: AuthUser?
    let error: String?
    let message: String?
}

// MARK: - OTP Verification

struct VerifyOtpRequest: Codable {
    let email: String
    let code: String
}

struct VerifyOtpResponse: Codable {
    let success: Bool?
    let user: AuthUser?
    let session: AuthSession?
    let message: String?
    let error: String?
}

// MARK: - User Liked/Saved Response

struct UserLikedResponse: Codable {
    let liked: [Article]
    let saved: [Article]
    let liked_ids: [String]
    let saved_ids: [String]
}

// MARK: - Google Auth

struct GoogleAuthRequest: Codable {
    let idToken: String

    enum CodingKeys: String, CodingKey {
        case idToken = "id_token"
    }
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

struct ResetPasswordRequest: Codable {
    let email: String
    let code: String
    let newPassword: String
}

struct ResetPasswordResponse: Codable {
    let success: Bool?
    let message: String?
    let error: String?
    let user: AuthUser?
    let session: AuthSession?
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

    var displayName: String {
        if let name, !name.isEmpty { return name }
        if let email, let username = email.split(separator: "@").first {
            return String(username)
        }
        return "User"
    }

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
