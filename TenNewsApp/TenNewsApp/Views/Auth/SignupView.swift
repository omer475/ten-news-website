import SwiftUI

/// Signup form with name/email/password fields
struct SignupView: View {
    @State private var viewModel = AuthViewModel()
    @Environment(\.dismiss) private var dismiss

    var onSignup: ((AuthUser, AuthSession?) -> Void)?
    var onShowLogin: (() -> Void)?

    var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            Spacer()

            // Header
            VStack(spacing: 8) {
                Text("Create account")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.Colors.primaryText)

                Text("Join Today+ for personalized news")
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.secondaryText)
            }

            Spacer()

            // Form fields
            VStack(spacing: Theme.Spacing.md) {
                // Name field
                VStack(alignment: .leading, spacing: 6) {
                    Text("Full Name")
                        .font(Theme.Fonts.captionMedium())
                        .foregroundStyle(Theme.Colors.secondaryText)

                    TextField("Your name", text: $viewModel.fullName)
                        .textContentType(.name)
                        .autocorrectionDisabled()
                        .padding(14)
                        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))
                }

                // Email field
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

                // Password field
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Password")
                            .font(Theme.Fonts.captionMedium())
                            .foregroundStyle(Theme.Colors.secondaryText)
                        Spacer()
                        Text("Min 6 characters")
                            .font(Theme.Fonts.footnote())
                            .foregroundStyle(Theme.Colors.tertiaryText)
                    }

                    SecureField("Password", text: $viewModel.password)
                        .textContentType(.newPassword)
                        .padding(14)
                        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))
                }
            }

            // Error message
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(Theme.Fonts.caption())
                    .foregroundStyle(Theme.Colors.destructive)
                    .multilineTextAlignment(.center)
            }

            // Signup button
            GlassCTAButton(
                title: "Create Account",
                action: {
                    Task {
                        if let result = await viewModel.signup() {
                            onSignup?(result.user, result.session)
                        }
                    }
                },
                isLoading: viewModel.isLoading,
                isDisabled: !viewModel.canSignup
            )

            // Login link
            HStack(spacing: 4) {
                Text("Already have an account?")
                    .font(Theme.Fonts.caption())
                    .foregroundStyle(Theme.Colors.secondaryText)

                Button("Sign In") {
                    onShowLogin?()
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
    SignupView()
}
