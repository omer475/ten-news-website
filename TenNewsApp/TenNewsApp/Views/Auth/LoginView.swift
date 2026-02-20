import SwiftUI

/// Login form with Material-backed text fields.
struct LoginView: View {
    @State private var viewModel = AuthViewModel()
    @Environment(\.dismiss) private var dismiss

    var onLogin: ((AuthUser, AuthSession?) -> Void)?
    var onShowSignup: (() -> Void)?
    var onShowForgotPassword: (() -> Void)?

    var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            Spacer()

            VStack(spacing: 8) {
                Text("Welcome back")
                    .font(.title.bold())
                    .foregroundStyle(Theme.Colors.primaryText)
                Text("Sign in to your account")
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.secondaryText)
            }

            Spacer()

            VStack(spacing: Theme.Spacing.md) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Email")
                        .font(Theme.Fonts.captionMedium())
                        .foregroundStyle(Theme.Colors.secondaryText)
                    TextField("you@example.com", text: $viewModel.email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .padding(14)
                        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Password")
                        .font(Theme.Fonts.captionMedium())
                        .foregroundStyle(Theme.Colors.secondaryText)
                    SecureField("Password", text: $viewModel.password)
                        .textContentType(.password)
                        .padding(14)
                        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))
                }

                HStack {
                    Spacer()
                    Button("Forgot password?") {
                        onShowForgotPassword?()
                    }
                    .font(Theme.Fonts.caption())
                    .foregroundStyle(Theme.Colors.accent)
                }
            }

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(Theme.Fonts.caption())
                    .foregroundStyle(Theme.Colors.destructive)
                    .multilineTextAlignment(.center)
            }

            GlassCTAButton(
                title: "Sign In",
                action: {
                    Task {
                        if let result = await viewModel.login() {
                            onLogin?(result.user, result.session)
                        }
                    }
                },
                isLoading: viewModel.isLoading,
                isDisabled: !viewModel.canLogin
            )

            HStack(spacing: 4) {
                Text("Don't have an account?")
                    .font(Theme.Fonts.caption())
                    .foregroundStyle(Theme.Colors.secondaryText)
                Button("Sign Up") {
                    onShowSignup?()
                }
                .font(Theme.Fonts.captionMedium())
                .foregroundStyle(Theme.Colors.accent)
            }

            Spacer()
        }
        .padding(.horizontal, Theme.Spacing.lg)
    }
}

#Preview {
    LoginView()
}
