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

    private let accent = Color(hex: "#3b82f6")

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {

                // MARK: - Header
                Text("Welcome back")
                    .font(.system(size: 30, weight: .bold))
                    .tracking(-0.8)
                    .foregroundStyle(.white)

                Text("Sign in to your Today+ account\nto continue reading.")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.5))
                    .lineSpacing(4)
                    .padding(.top, 10)

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
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(.white.opacity(0.15), lineWidth: 1)
                    )
                }
                .buttonStyle(LoginPressStyle())
                .padding(.top, 28)

                // Divider
                HStack(spacing: 12) {
                    Rectangle().fill(.white.opacity(0.15)).frame(height: 1)
                    Text("or")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.35))
                    Rectangle().fill(.white.opacity(0.15)).frame(height: 1)
                }
                .padding(.top, 20)
                .padding(.bottom, 20)

                // MARK: - Fields
                VStack(spacing: 0) {
                    // Email
                    HStack(spacing: 14) {
                        Image(systemName: "envelope")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(.white.opacity(0.4))
                            .frame(width: 20)
                        TextField("Email address", text: $viewModel.email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .font(.system(size: 16))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 54)

                    Divider().overlay(.white.opacity(0.1)).padding(.leading, 50)

                    // Password
                    HStack(spacing: 14) {
                        Image(systemName: "lock")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(.white.opacity(0.4))
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
                        .foregroundStyle(.white)

                        Button {
                            showPassword.toggle()
                            HapticManager.light()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(.white.opacity(0.4))
                                .frame(width: 28, height: 28)
                                .contentShape(Rectangle())
                        }
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 54)
                }
                .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 16))
                .overlay {
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(.white.opacity(0.1), lineWidth: 1)
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
                                .tint(.green)
                                .scaleEffect(0.85)
                        } else {
                            Image(systemName: "arrow.right")
                                .font(.system(size: 13, weight: .bold))
                            Text("Sign In")
                                .font(.system(size: 16, weight: .semibold))
                                .tracking(-0.2)
                        }
                    }
                    .foregroundStyle(viewModel.canLogin ? .green : .white.opacity(0.3))
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(.ultraThinMaterial, in: Capsule())
                    .overlay(Capsule().stroke(.white.opacity(0.12), lineWidth: 0.5))
                    .shadow(color: .black.opacity(0.2), radius: 12, y: 4)
                    .contentShape(Capsule())
                }
                .buttonStyle(LoginPressStyle())
                .disabled(!viewModel.canLogin || viewModel.isLoading)
                .padding(.top, 24)

                // MARK: - Switch to Signup
                HStack(spacing: 4) {
                    Text("Don't have an account?")
                        .foregroundStyle(.white.opacity(0.5))
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
        .background(Color.black.ignoresSafeArea())
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
