import SwiftUI

struct ForgotPasswordView: View {
    @State private var viewModel = AuthViewModel()
    @State private var showPassword = false
    @State private var codeVerified = false
    @State private var showCheckAnimation = false
    @State private var showResetSuccess = false
    @State private var pendingLoginResult: (user: AuthUser, session: AuthSession?)?
    @Environment(\.dismiss) private var dismiss

    var onPasswordReset: ((AuthUser, AuthSession?) -> Void)?

    private let accent = Color(hex: "#3b82f6")

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                Spacer().frame(height: 20)

                if showResetSuccess {
                    // Success animation after password reset
                    successAnimation
                } else if showCheckAnimation {
                    // Transition: checkmark animation after code verified
                    verifiedAnimation
                } else if codeVerified {
                    // STEP 3: Set new password (after code verified)
                    newPasswordStep
                } else if viewModel.showResetCodeEntry {
                    // STEP 2: Enter verification code
                    codeEntryStep
                } else {
                    // STEP 1: Enter email
                    emailEntryStep
                }

                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .background(Color.black.ignoresSafeArea())
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Step 1: Email

    private var emailEntryStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Forgot Password?")
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(.white)

            Text("Enter your email and we'll send you\na 6-digit code to reset your password.")
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.5))
                .lineSpacing(4)
                .padding(.top, 10)

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
            .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(.white.opacity(0.1), lineWidth: 1)
            }
            .padding(.top, 28)

            errorView
            successView

            Button {
                Task { await viewModel.forgotPassword() }
            } label: {
                ctaButton(label: "Send Code", enabled: viewModel.isEmailValid, loading: viewModel.isLoading)
            }
            .disabled(!viewModel.isEmailValid || viewModel.isLoading)
            .padding(.top, 24)
        }
    }

    // MARK: - Step 2: Code

    private var codeEntryStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Enter Code")
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(.white)

            Text("We sent a 6-digit code to\n\(viewModel.pendingResetEmail ?? "your email")")
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.5))
                .lineSpacing(4)
                .padding(.top, 10)

            TextField("000000", text: $viewModel.resetCode)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .font(.system(size: 32, weight: .semibold, design: .monospaced))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
                .padding(.vertical, 18)
                .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 16))
                .overlay {
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(.white.opacity(0.2), lineWidth: 1)
                }
                .padding(.top, 28)
                .onChange(of: viewModel.resetCode) { _, newValue in
                    let filtered = String(newValue.filter(\.isNumber).prefix(6))
                    if filtered != newValue { viewModel.resetCode = filtered }
                }

            errorView

            Button {
                viewModel.errorMessage = nil
                viewModel.successMessage = nil
                withAnimation(.easeInOut(duration: 0.3)) {
                    showCheckAnimation = true
                }
                // Show checkmark for 1.2s then transition to new password
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        showCheckAnimation = false
                        codeVerified = true
                    }
                }
            } label: {
                ctaButton(label: "Verify", enabled: viewModel.resetCode.count == 6, loading: false)
            }
            .disabled(viewModel.resetCode.count != 6)
            .padding(.top, 24)

            Button {
                viewModel.showResetCodeEntry = false
                viewModel.errorMessage = nil
            } label: {
                Text("Back")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.5))
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 16)
        }
    }

    // MARK: - Step 3: New Password

    private var newPasswordStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("New Password")
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(.white)

            Text("Choose a new password for your account.")
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.5))
                .padding(.top, 10)

            HStack(spacing: 14) {
                Image(systemName: "lock")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.white.opacity(0.4))
                    .frame(width: 20)
                Group {
                    if showPassword {
                        TextField("New password", text: $viewModel.newPassword)
                    } else {
                        SecureField("New password", text: $viewModel.newPassword)
                    }
                }
                .textContentType(.newPassword)
                .font(.system(size: 16))
                .foregroundStyle(.white)

                Button { showPassword.toggle() } label: {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white.opacity(0.4))
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 54)
            .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(.white.opacity(0.1), lineWidth: 1)
            }
            .padding(.top, 28)

            Text("Minimum 6 characters")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.3))
                .padding(.leading, 4)
                .padding(.top, 6)

            errorView
            successView

            Button {
                Task {
                    if let result = await viewModel.resetPassword() {
                        pendingLoginResult = result
                        withAnimation(.easeInOut(duration: 0.3)) {
                            showResetSuccess = true
                        }
                        // Auto-login after 1.5s animation
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            onPasswordReset?(result.user, result.session)
                        }
                    }
                }
            } label: {
                ctaButton(label: "Reset Password", enabled: viewModel.newPassword.count >= 6, loading: viewModel.isLoading)
            }
            .disabled(viewModel.newPassword.count < 6 || viewModel.isLoading)
            .padding(.top, 24)

            Button {
                withAnimation { codeVerified = false }
                viewModel.errorMessage = nil
            } label: {
                Text("Back")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.5))
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 16)
        }
    }

    // MARK: - Shared Components

    private func ctaButton(label: String, enabled: Bool, loading: Bool) -> some View {
        HStack {
            if loading {
                ProgressView().tint(.black).scaleEffect(0.85)
            } else {
                Text(label)
                    .font(.system(size: 16, weight: .semibold))
                    .tracking(-0.2)
            }
        }
        .foregroundStyle(enabled ? .black : .white.opacity(0.4))
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .background(
            enabled ? AnyShapeStyle(.white) : AnyShapeStyle(Color.white.opacity(0.1)),
            in: RoundedRectangle(cornerRadius: 26, style: .continuous)
        )
    }

    @ViewBuilder
    private var errorView: some View {
        if let error = viewModel.errorMessage {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.circle.fill").font(.system(size: 13))
                Text(error).font(.system(size: 13))
            }
            .foregroundStyle(.red)
            .padding(.top, 14)
        }
    }

    @ViewBuilder
    private var successView: some View {
        if let success = viewModel.successMessage {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 13))
                Text(success).font(.system(size: 13))
            }
            .foregroundStyle(.green)
            .padding(.top, 14)
        }
    }

    // MARK: - Verified Animation (after code entry)

    private var verifiedAnimation: some View {
        VStack(spacing: 20) {
            Spacer()
            ZStack {
                Circle()
                    .fill(.white.opacity(0.06))
                    .frame(width: 120, height: 120)
                Circle()
                    .fill(.white.opacity(0.04))
                    .frame(width: 160, height: 160)
                Image(systemName: "checkmark")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(.green)
                    .transition(.scale.combined(with: .opacity))
            }
            Text("Code Verified")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .transition(.opacity)
    }

    // MARK: - Success Animation (after password reset)

    private var successAnimation: some View {
        VStack(spacing: 20) {
            Spacer()
            ZStack {
                Circle()
                    .fill(.white.opacity(0.06))
                    .frame(width: 120, height: 120)
                Circle()
                    .fill(.white.opacity(0.04))
                    .frame(width: 160, height: 160)
                Image(systemName: "lock.open.fill")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundStyle(.white)
                    .transition(.scale.combined(with: .opacity))
            }
            Text("Password Reset")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white)
            Text("Signing you in...")
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.4))
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .transition(.opacity)
    }
}
