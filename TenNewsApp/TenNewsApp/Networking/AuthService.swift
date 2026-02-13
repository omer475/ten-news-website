import Foundation

struct AuthService {
    private let client = APIClient.shared

    func login(email: String, password: String) async throws -> LoginResponse {
        let body = LoginRequest(email: email, password: password)
        return try await client.post(APIEndpoints.login, body: body)
    }

    func signup(email: String, password: String, name: String? = nil) async throws -> SignupResponse {
        let body = SignupRequest(email: email, password: password, name: name)
        return try await client.post(APIEndpoints.signup, body: body)
    }

    func logout() async throws -> MessageResponse {
        try await client.post(APIEndpoints.logout, body: EmptyBody())
    }

    func forgotPassword(email: String) async throws -> ForgotPasswordResponse {
        let body = ForgotPasswordRequest(email: email)
        return try await client.post(APIEndpoints.forgotPassword, body: body)
    }
}

// MARK: - Empty Body for POST requests without a payload

struct EmptyBody: Encodable {}
