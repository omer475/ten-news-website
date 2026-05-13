import SwiftUI
import AuthenticationServices
import CryptoKit

@MainActor @Observable
final class AuthViewModel {
    var email: String = ""
    var password: String = ""
    var fullName: String = ""
    var username: String = ""
    var birthDate: Date?
    var otpCode: String = ""
    var isLoading = false
    var errorMessage: String?
    var successMessage: String?
    var showOtpVerification = false
    var pendingSignupEmail: String?
    var needsProfileCompletion = false   // set true after Google OAuth when profile is incomplete

    private let authService = AuthService()
    private let googleClientId = "465407271728-t3osp3o35l4hs6ei9coddr24bbsmbkda.apps.googleusercontent.com"

    /// ISO "YYYY-MM-DD" representation of birthDate, or nil when not set
    private var birthDateISO: String? {
        guard let birthDate else { return nil }
        let fmt = DateFormatter()
        fmt.calendar = Calendar(identifier: .gregorian)
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(secondsFromGMT: 0)
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: birthDate)
    }

    /// Username passes the same regex as the server (3-20, letters/numbers/_)
    var isUsernameValid: Bool {
        let trimmed = username.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 3, trimmed.count <= 20 else { return false }
        return trimmed.range(of: "^[a-zA-Z0-9_]+$", options: .regularExpression) != nil
    }

    /// 13-120 years old
    var isBirthDateValid: Bool {
        guard let birthDate else { return false }
        let years = Calendar.current.dateComponents([.year], from: birthDate, to: Date()).year ?? 0
        return years >= 13 && years <= 120
    }

    /// Validates email format
    var isEmailValid: Bool {
        let pattern = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        return email.range(of: pattern, options: .regularExpression) != nil
    }

    /// Validates password length
    var isPasswordValid: Bool { password.count >= 6 }

    /// Whether login form is valid
    var canLogin: Bool { isEmailValid && isPasswordValid }

    /// Whether signup form is valid (email + password + username + DOB)
    var canSignup: Bool {
        isEmailValid && isPasswordValid && isUsernameValid && isBirthDateValid
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
        let trimmedUsername = username.trimmingCharacters(in: .whitespaces)
        let trimmedName = fullName.trimmingCharacters(in: .whitespaces)
        do {
            let response = try await authService.signup(
                email: email,
                password: password,
                name: trimmedName.isEmpty ? trimmedUsername : trimmedName,
                username: trimmedUsername,
                dateOfBirth: birthDateISO
            )
            isLoading = false
            if response.requiresVerification == true {
                // OTP verification needed — show code entry screen
                pendingSignupEmail = email
                showOtpVerification = true
                successMessage = response.message
                return nil
            } else if let user = response.user {
                return (user, response.session)
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

    /// Call after Google OAuth when `needsProfileCompletion` is true.
    /// Sends username + DOB to /api/auth/complete-profile. Requires a valid session
    /// in keychain (AuthService wires the bearer token automatically).
    func completeProfile() async -> AuthUser? {
        guard isUsernameValid, isBirthDateValid, !isLoading else { return nil }
        isLoading = true
        errorMessage = nil
        let trimmedName = fullName.trimmingCharacters(in: .whitespaces)
        do {
            let response = try await authService.completeProfile(
                username: username.trimmingCharacters(in: .whitespaces),
                dateOfBirth: birthDateISO,
                name: trimmedName.isEmpty ? nil : trimmedName
            )
            isLoading = false
            if let user = response.user {
                needsProfileCompletion = false
                return user
            } else {
                errorMessage = response.error ?? response.message ?? "Could not save profile"
                return nil
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return nil
        }
    }

    func verifyOtp() async -> (user: AuthUser, session: AuthSession?)? {
        guard let verifyEmail = pendingSignupEmail, !otpCode.isEmpty, !isLoading else { return nil }
        isLoading = true
        errorMessage = nil
        do {
            let response = try await authService.verifyOtp(email: verifyEmail, code: otpCode.trimmingCharacters(in: .whitespaces))
            isLoading = false
            if let user = response.user {
                showOtpVerification = false
                pendingSignupEmail = nil
                return (user, response.session)
            } else {
                errorMessage = response.error ?? response.message ?? "Verification failed"
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

        // Build Google OAuth URL — iOS clients use reversed client ID as scheme.
        // iOS OAuth 2.0 clients in Google Cloud have no client_secret — we must
        // use PKCE (RFC 7636) to exchange the auth code on the backend.
        let reversedClientId = "com.googleusercontent.apps.465407271728-t3osp3o35l4hs6ei9coddr24bbsmbkda"
        let redirectURI = "\(reversedClientId):/oauth2callback"
        let scope = "openid email profile"
        let codeVerifier = Self.makePKCEVerifier()
        let codeChallenge = Self.pkceChallenge(for: codeVerifier)
        let authURL = "https://accounts.google.com/o/oauth2/v2/auth"
            + "?client_id=\(googleClientId)"
            + "&redirect_uri=\(redirectURI.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? redirectURI)"
            + "&response_type=code"
            + "&scope=\(scope.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? scope)"
            + "&code_challenge=\(codeChallenge)"
            + "&code_challenge_method=S256"
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

            // Send auth code + PKCE verifier to backend for token exchange.
            let response = try await authService.googleAuth(idToken: code, codeVerifier: codeVerifier)
            isLoading = false

            if let user = response.user {
                needsProfileCompletion = response.needsProfile ?? false
                return (user, response.session)
            } else {
                errorMessage = response.error ?? "Google sign-in failed"
                return nil
            }
        } catch {
            if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                // User cancelled — don't show error
            } else if let apiError = error as? APIError {
                // Surface the backend's actual error message (e.g. the Google
                // error_description) instead of a generic string.
                errorMessage = apiError.errorDescription ?? "Google sign-in failed"
            } else {
                errorMessage = "Google sign-in failed: \(error.localizedDescription)"
            }
            isLoading = false
            return nil
        }
    }

    var showResetCodeEntry = false
    var resetCode: String = ""
    var newPassword: String = ""
    var pendingResetEmail: String?

    func forgotPassword() async {
        guard isEmailValid, !isLoading else { return }
        isLoading = true
        errorMessage = nil
        successMessage = nil
        do {
            let response = try await authService.forgotPassword(email: email)
            isLoading = false
            if response.success == true {
                pendingResetEmail = email
                showResetCodeEntry = true
                successMessage = "Check your email for the 6-digit code."
            } else {
                successMessage = response.message ?? "If an account exists, you'll receive a code."
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func resetPassword() async -> (user: AuthUser, session: AuthSession?)? {
        guard let resetEmail = pendingResetEmail,
              !resetCode.isEmpty,
              newPassword.count >= 6,
              !isLoading else { return nil }
        isLoading = true
        errorMessage = nil
        do {
            let response = try await authService.resetPassword(
                email: resetEmail,
                code: resetCode.trimmingCharacters(in: .whitespaces),
                newPassword: newPassword
            )
            isLoading = false
            if response.success == true {
                successMessage = response.message ?? "Password updated!"
                showResetCodeEntry = false
                pendingResetEmail = nil
                // User + session returned — auto sign in
                if let user = response.user, let session = response.session {
                    return (user, session)
                }
                return nil
            } else {
                errorMessage = response.error ?? response.message ?? "Reset failed"
                return nil
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return nil
        }
    }

    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }

    // MARK: - PKCE helpers (RFC 7636) for Google OAuth on iOS

    /// 64 random bytes → base64url-encoded → 86 char verifier.
    private static func makePKCEVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 64)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }

    /// code_challenge = base64url(SHA256(code_verifier))
    private static func pkceChallenge(for verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return Data(digest).base64URLEncodedString()
    }
}

private extension Data {
    /// Base64URL without padding (per RFC 4648 §5) — what OAuth PKCE needs.
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
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
