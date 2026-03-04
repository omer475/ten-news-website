import SwiftUI

@MainActor @Observable
final class AuthViewModel {
    var email: String = ""
    var password: String = ""
    var fullName: String = ""
    var isLoading = false
    var errorMessage: String?
    var successMessage: String?

    private let authService = AuthService()

    /// Validates email format
    var isEmailValid: Bool {
        let pattern = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        return email.range(of: pattern, options: .regularExpression) != nil
    }

    /// Validates password length
    var isPasswordValid: Bool { password.count >= 6 }

    /// Whether login form is valid
    var canLogin: Bool { isEmailValid && isPasswordValid }

    /// Whether signup form is valid
    var canSignup: Bool {
        isEmailValid && isPasswordValid && !fullName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func login() async -> (user: AuthUser, session: AuthSession?)? {
        guard canLogin, !isLoading else { return nil }
        isLoading = true
        errorMessage = nil
        do {
            let response = try await authService.login(email: email, password: password)
            isLoading = false
            if let user = response.user {
                return (user, response.session)
            } else {
                errorMessage = response.error ?? response.message ?? "Login failed"
                return nil
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return nil
        }
    }

    func signup() async -> (user: AuthUser, session: AuthSession?)? {
        guard canSignup, !isLoading else { return nil }
        isLoading = true
        errorMessage = nil
        do {
            let response = try await authService.signup(
                email: email,
                password: password,
                name: fullName.trimmingCharacters(in: .whitespaces)
            )
            isLoading = false
            if let user = response.user {
                let session = response.session
                return (user, session)
            } else {
                errorMessage = response.error ?? response.message ?? "Signup failed"
                return nil
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return nil
        }
    }

    func forgotPassword() async {
        guard isEmailValid, !isLoading else { return }
        isLoading = true
        errorMessage = nil
        successMessage = nil
        do {
            let response = try await authService.forgotPassword(email: email)
            isLoading = false
            successMessage = response.message ?? "Password reset email sent"
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }
}
