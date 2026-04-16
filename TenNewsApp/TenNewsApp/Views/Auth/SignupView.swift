import SwiftUI

struct SignupView: View {
    @State private var viewModel = AuthViewModel()
    @State private var showPassword = false
    @Environment(\.dismiss) private var dismiss

    var onSignup: ((AuthUser, AuthSession?) -> Void)?
    var onShowLogin: (() -> Void)?

    private let accent = Color(hex: "#3b82f6")

    var body: some View {
        if viewModel.showOtpVerification {
            OtpVerificationView(viewModel: viewModel) { user, session in
                onSignup?(user, session)
            }
        } else {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {

                // MARK: - Header
                Text("Join Today")
                    .font(.system(size: 30, weight: .bold))
                    .tracking(-0.8)
                    .foregroundStyle(.white)
                +
                Text("+")
                    .font(.system(size: 30, weight: .bold))
                    .tracking(-0.8)
                    .foregroundStyle(accent)

                Text("Create your account to get\npersonalized news delivered daily.")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.5))
                    .lineSpacing(4)
                    .padding(.top, 10)

                // MARK: - Google Sign Up
                Button {
                    HapticManager.medium()
                    Task {
                        if let result = await viewModel.signInWithGoogle() {
                            onSignup?(result.user, result.session)
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
                .buttonStyle(AuthPressStyle())
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
                    // Name
                    HStack(spacing: 14) {
                        Image(systemName: "person")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(.white.opacity(0.4))
                            .frame(width: 20)
                        TextField("Full name", text: $viewModel.fullName)
                            .textContentType(.name)
                            .autocorrectionDisabled()
                            .font(.system(size: 16))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 54)

                    Divider().overlay(.white.opacity(0.1)).padding(.leading, 50)

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
                        .textContentType(.newPassword)
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

                // Password hint
                Text("Minimum 6 characters")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.3))
                    .padding(.leading, 4)
                    .padding(.top, 8)

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
                        if let result = await viewModel.signup() {
                            onSignup?(result.user, result.session)
                        }
                    }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isLoading {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.85)
                        } else {
                            Text("Create Account")
                                .font(.system(size: 16, weight: .semibold))
                                .tracking(-0.2)
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(viewModel.canSignup ? AnyShapeStyle(accent.gradient) : AnyShapeStyle(Color.white.opacity(0.1)))
                    }
                    .contentShape(RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(AuthPressStyle())
                .disabled(!viewModel.canSignup || viewModel.isLoading)
                .padding(.top, 24)

                // MARK: - Switch to Login
                HStack(spacing: 4) {
                    Text("Already have an account?")
                        .foregroundStyle(.white.opacity(0.5))
                    Button {
                        onShowLogin?()
                    } label: {
                        Text("Sign In")
                            .fontWeight(.semibold)
                            .foregroundStyle(accent)
                    }
                }
                .font(.system(size: 14))
                .frame(maxWidth: .infinity)
                .padding(.top, 20)

                // MARK: - Legal
                Text("By creating an account, you agree to our Terms of Service and Privacy Policy.")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.25))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 24)
            }
            .padding(.horizontal, 24)
            .padding(.top, 28)
            .padding(.bottom, 40)
        }
        .background(Color.black.ignoresSafeArea())
        .scrollDismissesKeyboard(.interactively)
        } // end else (non-OTP view)
    }
}

private struct AuthPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

#Preview {
    NavigationStack {
        SignupView()
            .navigationTitle("Create Account")
            .navigationBarTitleDisplayMode(.inline)
    }
}
