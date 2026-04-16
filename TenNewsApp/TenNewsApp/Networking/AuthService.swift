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

    func verifyOtp(email: String, code: String) async throws -> VerifyOtpResponse {
        let body = VerifyOtpRequest(email: email, code: code)
        return try await client.post(APIEndpoints.verifyOtp, body: body)
    }

    func logout() async throws -> MessageResponse {
        try await client.post(APIEndpoints.logout, body: EmptyBody())
    }

    func forgotPassword(email: String) async throws -> ForgotPasswordResponse {
        let body = ForgotPasswordRequest(email: email)
        return try await client.post(APIEndpoints.forgotPassword, body: body)
    }

    func resetPassword(email: String, code: String, newPassword: String) async throws -> ResetPasswordResponse {
        let body = ResetPasswordRequest(email: email, code: code, newPassword: newPassword)
        return try await client.post(APIEndpoints.resetPassword, body: body)
    }

    func googleAuth(idToken: String) async throws -> LoginResponse {
        let body = GoogleAuthRequest(idToken: idToken)
        return try await client.post(APIEndpoints.googleAuth, body: body)
    }
}

// MARK: - Empty Body for POST requests without a payload

struct EmptyBody: Encodable {}
