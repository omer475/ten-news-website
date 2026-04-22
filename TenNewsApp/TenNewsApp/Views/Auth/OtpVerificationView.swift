import SwiftUI

struct OtpVerificationView: View {
    @Bindable var viewModel: AuthViewModel
    var onVerified: ((AuthUser, AuthSession?) -> Void)?

    @FocusState private var isCodeFocused: Bool

    private let accent = Color(hex: "#3b82f6")

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer().frame(height: 60)

            Text("Check your email")
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(.white)

            Text("We sent a 6-digit code to\n\(viewModel.pendingSignupEmail ?? "your email")")
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.5))
                .lineSpacing(4)
                .padding(.top, 10)

            // Code input
            TextField("000000", text: $viewModel.otpCode)
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
                        .strokeBorder(accent.opacity(0.4), lineWidth: 1)
                }
                .padding(.top, 36)
                .focused($isCodeFocused)
                .onChange(of: viewModel.otpCode) { _, newValue in
                    // Limit to 6 digits
                    let filtered = String(newValue.filter(\.isNumber).prefix(6))
                    if filtered != newValue { viewModel.otpCode = filtered }
                }

            // Error
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

            // Verify button
            Button {
                Task {
                    if let result = await viewModel.verifyOtp() {
                        onVerified?(result.user, result.session)
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(.green)
                            .scaleEffect(0.85)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.system(size: 13, weight: .bold))
                        Text("Verify")
                            .font(.system(size: 16, weight: .semibold))
                            .tracking(-0.2)
                    }
                }
                .foregroundStyle(viewModel.otpCode.count == 6 ? .green : .white.opacity(0.3))
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke(.white.opacity(0.12), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.2), radius: 12, y: 4)
                .contentShape(Capsule())
            }
            .disabled(viewModel.otpCode.count != 6 || viewModel.isLoading)
            .padding(.top, 24)

            // Back button
            Button {
                viewModel.showOtpVerification = false
                viewModel.otpCode = ""
                viewModel.errorMessage = nil
            } label: {
                Text("Back to signup")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.5))
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 20)

            Spacer()
        }
        .padding(.horizontal, 24)
        .background(Color.black.ignoresSafeArea())
        .onAppear { isCodeFocused = true }
    }
}
