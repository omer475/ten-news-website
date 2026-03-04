import SwiftUI

struct LoginView: View {
    @State private var viewModel = AuthViewModel()
    @State private var showPassword = false
    @Environment(\.dismiss) private var dismiss

    var onLogin: ((AuthUser, AuthSession?) -> Void)?
    var onShowSignup: (() -> Void)?
    var onShowForgotPassword: (() -> Void)?

    // Palette
    private let warmBlack = Color(hex: "#1a1a2e")
    private let warmGray = Color(hex: "#6b7280")
    private let lightGray = Color(hex: "#9ca3af")
    private let accent = Color(hex: "#3b82f6")
    private let fieldBg = Color.white
    private let fieldBorder = Color.black.opacity(0.07)

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {

                // MARK: - Header
                Text("Welcome back")
                    .font(.system(size: 30, weight: .bold))
                    .tracking(-0.8)
                    .foregroundStyle(warmBlack)

                Text("Sign in to your Today+ account\nto continue reading.")
                    .font(.system(size: 15))
                    .foregroundStyle(warmGray)
                    .lineSpacing(4)
                    .padding(.top, 10)

                // MARK: - Fields
                VStack(spacing: 0) {
                    // Email
                    HStack(spacing: 14) {
                        Image(systemName: "envelope")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(lightGray)
                            .frame(width: 20)
                        TextField("Email address", text: $viewModel.email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .font(.system(size: 16))
                            .foregroundStyle(warmBlack)
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 54)

                    Divider().padding(.leading, 50)

                    // Password
                    HStack(spacing: 14) {
                        Image(systemName: "lock")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(lightGray)
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
                        .foregroundStyle(warmBlack)

                        Button {
                            showPassword.toggle()
                            HapticManager.light()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(lightGray)
                                .frame(width: 28, height: 28)
                                .contentShape(Rectangle())
                        }
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 54)
                }
                .background(fieldBg, in: RoundedRectangle(cornerRadius: 16))
                .overlay {
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(fieldBorder, lineWidth: 1)
                }
                .padding(.top, 32)

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
                            Text("Sign In")
                                .font(.system(size: 16, weight: .semibold))
                                .tracking(-0.2)
                        }
                    }
                    .foregroundStyle(viewModel.canLogin ? .white : .white.opacity(0.35))
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(
                        viewModel.canLogin ? warmBlack : warmBlack.opacity(0.18),
                        in: RoundedRectangle(cornerRadius: 16)
                    )
                    .contentShape(RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(LoginPressStyle())
                .disabled(!viewModel.canLogin || viewModel.isLoading)
                .padding(.top, 24)

                // MARK: - Switch to Signup
                HStack(spacing: 4) {
                    Text("Don't have an account?")
                        .foregroundStyle(warmGray)
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
        .background(Color(hex: "#f8f8f6").ignoresSafeArea())
        .onTapGesture { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil) }
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
