import SwiftUI
import AuthenticationServices

@MainActor @Observable
final class AuthViewModel {
    var email: String = ""
    var password: String = ""
    var fullName: String = ""
    var isLoading = false
    var errorMessage: String?
    var successMessage: String?

    private let authService = AuthService()
    private let googleClientId = "465407271728-t3osp3o35l4hs6ei9coddr24bbsmbkda.apps.googleusercontent.com"

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

    func signInWithGoogle() async -> (user: AuthUser, session: AuthSession?)? {
        guard !isLoading else { return nil }
        isLoading = true
        errorMessage = nil

        // Build Google OAuth URL — iOS clients use reversed client ID as scheme
        let reversedClientId = "com.googleusercontent.apps.465407271728-t3osp3o35l4hs6ei9coddr24bbsmbkda"
        let redirectURI = "\(reversedClientId):/oauth2callback"
        let scope = "openid email profile"
        let authURL = "https://accounts.google.com/o/oauth2/v2/auth"
            + "?client_id=\(googleClientId)"
            + "&redirect_uri=\(redirectURI.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? redirectURI)"
            + "&response_type=code"
            + "&scope=\(scope.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? scope)"
            + "&nonce=\(UUID().uuidString)"

        guard let url = URL(string: authURL) else {
            errorMessage = "Failed to create auth URL"
            isLoading = false
            return nil
        }

        do {
            let callbackURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
                let session = ASWebAuthenticationSession(url: url, callbackURLScheme: reversedClientId) { callbackURL, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else if let callbackURL {
                        continuation.resume(returning: callbackURL)
                    } else {
                        continuation.resume(throwing: NSError(domain: "GoogleAuth", code: -1, userInfo: [NSLocalizedDescriptionKey: "No callback received"]))
                    }
                }
                session.prefersEphemeralWebBrowserSession = false
                session.presentationContextProvider = GoogleAuthContextProvider.shared
                session.start()
            }

            // Extract auth code from callback URL query
            guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                  let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
                errorMessage = "Failed to get token from Google"
                isLoading = false
                return nil
            }

            // Send auth code to backend for token exchange
            let response = try await authService.googleAuth(idToken: code)
            isLoading = false

            if let user = response.user {
                return (user, response.session)
            } else {
                errorMessage = response.error ?? "Google sign-in failed"
                return nil
            }
        } catch {
            if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                // User cancelled — don't show error
            } else {
                errorMessage = "Google sign-in failed"
            }
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

// MARK: - ASWebAuthenticationSession Context Provider

final class GoogleAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = GoogleAuthContextProvider()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}
