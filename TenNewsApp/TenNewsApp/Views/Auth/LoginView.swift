import SwiftUI

struct LoginView: View {
    @State private var viewModel = AuthViewModel()
    @State private var showPassword = false
    @State private var pendingGoogleAuth: (user: AuthUser, session: AuthSession?)?
    @State private var showCompleteProfile = false
    @Environment(\.dismiss) private var dismiss

    var onLogin: ((AuthUser, AuthSession?) -> Void)?
    var onShowSignup: (() -> Void)?
    var onShowForgotPassword: (() -> Void)?

    // Saturated blue accent — Apple's system blue is too bright for a CTA,
    // and the previous #3b82f6 looked washed out on white. #2563EB is the
    // standard "primary" blue used by Linear / Vercel / Notion CTAs.
    private let accent = Color(hex: "#2563EB")

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {

                // MARK: - Header
                Text("Welcome back")
                    .font(.system(size: 30, weight: .bold))
                    .tracking(-0.8)
                    .foregroundStyle(Color.primary)

                Text("Sign in to your Today+ account\nto continue reading.")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.secondary)
                    .lineSpacing(4)
                    .padding(.top, 10)

                // MARK: - Sign in with Apple
                Button {
                    HapticManager.medium()
                    Task {
                        if let result = await viewModel.signInWithApple() {
                            if viewModel.needsProfileCompletion {
                                pendingGoogleAuth = result
                                showCompleteProfile = true
                            } else {
                                onLogin?(result.user, result.session)
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "applelogo")
                            .font(.system(size: 18, weight: .medium))
                        Text("Continue with Apple")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    // Apple HIG for light mode: black pill, white text.
                    // (On dark pages it's white pill with black text — but
                    // this sheet is now light.)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Color.black, in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(LoginPressStyle())
                .padding(.top, 28)

                // MARK: - Google Sign In
                Button {
                    HapticManager.medium()
                    Task {
                        if let result = await viewModel.signInWithGoogle() {
                            if viewModel.needsProfileCompletion {
                                pendingGoogleAuth = result
                                showCompleteProfile = true
                            } else {
                                onLogin?(result.user, result.session)
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "g.circle.fill")
                            .font(.system(size: 20))
                        Text("Continue with Google")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    // Google branding HIG for light: white pill, dark text,
                    // defined hairline border so it doesn't disappear into
                    // the page bg.
                    .foregroundStyle(Color.black)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(Color.black.opacity(0.18), lineWidth: 1)
                    )
                }
                .buttonStyle(LoginPressStyle())
                .padding(.top, 12)

                // Divider
                HStack(spacing: 12) {
                    Rectangle().fill(Color.black.opacity(0.1)).frame(height: 1)
                    Text("or")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.secondary)
                    Rectangle().fill(Color.black.opacity(0.1)).frame(height: 1)
                }
                .padding(.top, 20)
                .padding(.bottom, 20)

                // MARK: - Fields
                VStack(spacing: 0) {
                    // Email
                    HStack(spacing: 14) {
                        Image(systemName: "envelope")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Color.secondary)
                            .frame(width: 20)
                        TextField("Email address", text: $viewModel.email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .font(.system(size: 16))
                            .foregroundStyle(Color.primary)
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 54)

                    Divider().overlay(Color.black.opacity(0.08)).padding(.leading, 50)

                    // Password
                    HStack(spacing: 14) {
                        Image(systemName: "lock")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(Color.secondary)
                            .frame(width: 20)

                        Group {
                            if showPassword {
                                TextField("Password", text: $viewModel.password)
                            } else {
                                SecureField("Password", text: $viewModel.password)
                            }
                        }
                        .textContentType(.password)
                        .font(.system(size: 16))
                        .foregroundStyle(Color.primary)

                        Button {
                            showPassword.toggle()
                            HapticManager.light()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color.secondary)
                                .frame(width: 28, height: 28)
                                .contentShape(Rectangle())
                        }
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 54)
                }
                // Slightly stronger fill + border so the input box reads as
                // an actual interactive field on white (iOS Settings rows
                // do roughly this contrast).
                .background(Color(white: 0.95), in: RoundedRectangle(cornerRadius: 16))
                .overlay {
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(Color.black.opacity(0.14), lineWidth: 1)
                }

                // Forgot password
                HStack {
                    Spacer()
                    Button {
                        onShowForgotPassword?()
                    } label: {
                        Text("Forgot password?")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(accent)
                            .contentShape(Rectangle())
                    }
                }
                .padding(.top, 12)

                // MARK: - Error
                if let error = viewModel.errorMessage {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.system(size: 13))
                        Text(error)
                            .font(.system(size: 13))
                    }
                    .foregroundStyle(.red)
                    .padding(.top, 14)
                }

                // MARK: - CTA
                Button {
                    Task {
                        if let result = await viewModel.login() {
                            onLogin?(result.user, result.session)
                        }
                    }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isLoading {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.85)
                        } else {
                            Image(systemName: "arrow.right")
                                .font(.system(size: 13, weight: .bold))
                            Text("Sign In")
                                .font(.system(size: 16, weight: .semibold))
                                .tracking(-0.2)
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    // Disabled state stays the same blue, just darkened with
                    // a 0.45 mix toward a neutral gray rather than dropping
                    // opacity to 35% (which made it look like a placeholder).
                    .background(viewModel.canLogin ? accent : Color(white: 0.78), in: Capsule())
                    .shadow(color: accent.opacity(viewModel.canLogin ? 0.30 : 0), radius: 16, y: 8)
                    .contentShape(Capsule())
                }
                .buttonStyle(LoginPressStyle())
                .disabled(!viewModel.canLogin || viewModel.isLoading)
                .padding(.top, 24)

                // MARK: - Switch to Signup
                HStack(spacing: 4) {
                    Text("Don't have an account?")
                        .foregroundStyle(Color.secondary)
                    Button {
                        onShowSignup?()
                    } label: {
                        Text("Sign Up")
                            .fontWeight(.semibold)
                            .foregroundStyle(accent)
                    }
                }
                .font(.system(size: 14))
                .frame(maxWidth: .infinity)
                .padding(.top, 20)
            }
            .padding(.horizontal, 24)
            .padding(.top, 28)
            .padding(.bottom, 40)
        }
        .background(Color.white.ignoresSafeArea())
        // Force light scheme on the sign-in sheet to match the welcome
        // screen — Color.primary / Color.secondary resolve to dark text.
        .environment(\.colorScheme, .light)
        .scrollDismissesKeyboard(.interactively)
        .fullScreenCover(isPresented: $showCompleteProfile) {
            CompleteProfileView(viewModel: viewModel) { _ in
                let pending = pendingGoogleAuth
                showCompleteProfile = false
                pendingGoogleAuth = nil
                if let pending {
                    onLogin?(pending.user, pending.session)
                }
            }
        }
    }
}

private struct LoginPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

#Preview {
    NavigationStack {
        LoginView()
            .navigationTitle("Sign In")
            .navigationBarTitleDisplayMode(.inline)
    }
}
