import SwiftUI

struct ForgotPasswordView: View {
    @State private var viewModel = AuthViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Image(systemName: "lock.rotation")
                        .font(.system(size: 48))
                        .foregroundStyle(Theme.Colors.accent)
                    Text("Reset Password")
                        .font(.system(size: 28, weight: .bold))
                    Text("Enter your email to receive a reset link")
                        .font(Theme.Fonts.body())
                        .foregroundStyle(Theme.Colors.secondaryText)
                }
                .padding(.top, Theme.Spacing.xl)

                TextField("Email", text: $viewModel.email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .padding()
                    .background(Theme.Colors.backgroundSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(Theme.Fonts.caption())
                        .foregroundStyle(Theme.Colors.destructive)
                }

                if let success = viewModel.successMessage {
                    Text(success)
                        .font(Theme.Fonts.caption())
                        .foregroundStyle(Color(hex: "#34C759"))
                }

                GlassCTAButton(
                    title: "Send Reset Link",
                    action: {
                        Task { await viewModel.forgotPassword() }
                    },
                    isLoading: viewModel.isLoading,
                    isDisabled: !viewModel.isEmailValid
                )

                Spacer()
            }
            .padding(Theme.Spacing.lg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    ForgotPasswordView()
}
