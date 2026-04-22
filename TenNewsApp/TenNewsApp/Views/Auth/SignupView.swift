import SwiftUI

struct SignupView: View {
    @State private var viewModel = AuthViewModel()
    @State private var step: SignupStep = .email
    @State private var dayInput: String = ""
    @State private var monthInput: String = ""
    @State private var yearInput: String = ""
    @State private var pickerDate: Date = Calendar.current.date(byAdding: .year, value: -22, to: Date()) ?? Date()
    @State private var dobFocus: DobField?
    @State private var username: String = ""
    @State private var showPassword = false
    @State private var pendingGoogleAuth: (user: AuthUser, session: AuthSession?)?
    @State private var showCompleteProfile = false
    @FocusState private var focusedField: Field?
    @Environment(\.dismiss) private var dismiss

    var onSignup: ((AuthUser, AuthSession?) -> Void)?
    var onShowLogin: (() -> Void)?
    var onBack: (() -> Void)?

    enum SignupStep: Int, CaseIterable {
        case email, age, username, password
    }

    enum Field: Hashable { case email, username, password }
    enum DobField: Hashable { case day, month, year }

    private var computedBirthDate: Date? {
        guard let m = Int(monthInput), m >= 1, m <= 12,
              let d = Int(dayInput), d >= 1, d <= 31,
              let y = Int(yearInput), y >= 1900,
              y <= Calendar.current.component(.year, from: Date()) else {
            return nil
        }
        var comps = DateComponents()
        comps.month = m; comps.day = d; comps.year = y
        guard let date = Calendar.current.date(from: comps), date <= Date() else { return nil }
        // Verify the components round-trip (catches "31 Feb")
        let actual = Calendar.current.dateComponents([.month, .day, .year], from: date)
        guard actual.month == m, actual.day == d, actual.year == y else { return nil }
        return date
    }

    private var age: Int {
        guard let date = computedBirthDate else { return 0 }
        return Calendar.current.dateComponents([.year], from: date, to: Date()).year ?? 0
    }

    private var isBirthDateValid: Bool {
        computedBirthDate != nil && age >= 13 && age <= 120
    }

    private var isUsernameValid: Bool {
        let trimmed = username.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 3, trimmed.count <= 20 else { return false }
        return trimmed.range(of: "^[a-zA-Z0-9_]+$", options: .regularExpression) != nil
    }

    private var passwordStrength: PasswordStrength {
        PasswordStrength.compute(viewModel.password)
    }

    private var canProceed: Bool {
        switch step {
        case .email: return viewModel.isEmailValid
        case .age: return isBirthDateValid
        case .username: return isUsernameValid
        case .password: return viewModel.isPasswordValid
        }
    }

    var body: some View {
        if viewModel.showOtpVerification {
            OtpVerificationView(viewModel: viewModel) { user, session in
                onSignup?(user, session)
            }
        } else {
            signupFlow
        }
    }

    private var signupFlow: some View {
        ZStack {
            // Pure black background with subtle starfield
            Color.black.ignoresSafeArea()

            TimelineView(.animation) { timeline in
                SignupStarfield(time: timeline.date.timeIntervalSinceReferenceDate)
            }
            .allowsHitTesting(false)
            .ignoresSafeArea()

            VStack(spacing: 0) {
                // Top bar
                topBar

                // Progress indicator
                progressDots
                    .padding(.top, 6)
                    .padding(.bottom, 20)

                // Step content
                Group {
                    switch step {
                    case .email:    emailStep
                    case .age:      ageStep
                    case .username: usernameStep
                    case .password: passwordStep
                    }
                }
                .transition(stepTransition)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)

                // Error banner
                if let error = viewModel.errorMessage {
                    errorBanner(error)
                        .padding(.bottom, 8)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                // CTA
                continueButton
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)

                // Footer: switch to login (only on email step)
                if step == .email {
                    loginSwitchFooter
                        .padding(.bottom, 20)
                        .transition(.opacity)
                } else {
                    Color.clear.frame(height: 20)
                }
            }
            .padding(.top, 8)
        }
        .background(Color.black)
        .scrollDismissesKeyboard(.interactively)
        .fullScreenCover(isPresented: $showCompleteProfile) {
            CompleteProfileView(viewModel: viewModel) { _ in
                let pending = pendingGoogleAuth
                showCompleteProfile = false
                pendingGoogleAuth = nil
                if let pending {
                    onSignup?(pending.user, pending.session)
                }
            }
        }
        .onAppear {
            focusedField = .email
            let args = ProcessInfo.processInfo.arguments
            if args.contains("--screenshot-signup-age") {
                step = .age
                focusedField = nil
                dobFocus = .day
            } else if args.contains("--screenshot-signup-username") {
                step = .username
                focusedField = .username
            } else if args.contains("--screenshot-signup-password") {
                step = .password
                focusedField = .password
            }
        }
        .onChange(of: step) { _, new in
            viewModel.clearMessages()
            switch new {
            case .email:    focusedField = .email
            case .age:
                focusedField = nil
                dobFocus = .day
            case .username: focusedField = .username
            case .password: focusedField = .password
            }
            HapticManager.selection()
        }
    }

    private var stepTransition: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .trailing).combined(with: .opacity),
            removal: .move(edge: .leading).combined(with: .opacity)
        )
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            Button {
                HapticManager.light()
                if step == .email {
                    if let onBack { onBack() } else { dismiss() }
                } else if let prev = SignupStep(rawValue: step.rawValue - 1) {
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
                        step = prev
                    }
                }
            } label: {
                Image(systemName: step == .email ? "xmark" : "chevron.left")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white.opacity(0.8))
                    .frame(width: 38, height: 38)
                    .background(.white.opacity(0.1), in: Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(0.12), lineWidth: 1))
            }

            Spacer()

            Text("Step \(step.rawValue + 1) of \(SignupStep.allCases.count)")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.4))

            Spacer()

            Color.clear.frame(width: 38, height: 38)
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Progress dots

    private var progressDots: some View {
        HStack(spacing: 6) {
            ForEach(SignupStep.allCases, id: \.rawValue) { s in
                Capsule()
                    .fill(s.rawValue <= step.rawValue ? Color.white : Color.white.opacity(0.18))
                    .frame(width: s == step ? 28 : 6, height: 6)
                    .animation(.spring(response: 0.5, dampingFraction: 0.8), value: step)
            }
        }
    }

    // MARK: - Step 1: Email

    private var emailStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepHeader(
                title: "What's your email?",
                subtitle: "We'll send you a code to verify it's really you."
            )

            inputField(
                icon: "envelope.fill",
                placeholder: "you@example.com",
                text: $viewModel.email,
                validated: viewModel.isEmailValid,
                keyboard: .emailAddress,
                contentType: .emailAddress,
                field: .email
            )
            .padding(.top, 28)

            // Google sign up as alternative on first step
            VStack(spacing: 14) {
                HStack(spacing: 10) {
                    Rectangle().fill(.white.opacity(0.1)).frame(height: 1)
                    Text("or continue with")
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.35))
                        .textCase(.uppercase)
                        .tracking(0.8)
                    Rectangle().fill(.white.opacity(0.1)).frame(height: 1)
                }

                Button {
                    HapticManager.medium()
                    Task {
                        if let result = await viewModel.signInWithGoogle() {
                            if viewModel.needsProfileCompletion {
                                pendingGoogleAuth = result
                                showCompleteProfile = true
                            } else {
                                onSignup?(result.user, result.session)
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "g.circle.fill")
                            .font(.system(size: 18))
                        Text("Continue with Google")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.interactive(), in: Capsule())
            }
            .padding(.top, 32)
        }
        .padding(.horizontal, 24)
    }

    // MARK: - Step 2: Date of birth

    private var ageStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepHeader(
                title: "When's your birthday?",
                subtitle: "We use this to personalize your feed. Must be at least 13."
            )

            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.45))
                    .frame(width: 22)
                    .padding(.trailing, 4)

                DobSegment(
                    text: $dayInput,
                    placeholder: "DD",
                    maxLength: 2,
                    isFocused: dobFocus == .day,
                    onFocus: { dobFocus = .day },
                    onFilled: { dobFocus = .month },
                    onBackspaceEmpty: {}
                )
                .frame(width: 40, height: 36)
                dobSlash
                DobSegment(
                    text: $monthInput,
                    placeholder: "MM",
                    maxLength: 2,
                    isFocused: dobFocus == .month,
                    onFocus: { dobFocus = .month },
                    onFilled: { dobFocus = .year },
                    onBackspaceEmpty: { dobFocus = .day }
                )
                .frame(width: 40, height: 36)
                dobSlash
                DobSegment(
                    text: $yearInput,
                    placeholder: "YYYY",
                    maxLength: 4,
                    isFocused: dobFocus == .year,
                    onFocus: { dobFocus = .year },
                    onFilled: {},
                    onBackspaceEmpty: { dobFocus = .month }
                )
                .frame(width: 64, height: 36)

                Spacer(minLength: 0)

                // Calendar picker button
                ZStack {
                    Image(systemName: "calendar.badge.clock")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.7))
                        .frame(width: 32, height: 32)
                        .allowsHitTesting(false)

                    DatePicker(
                        "",
                        selection: $pickerDate,
                        in: Date(timeIntervalSince1970: 0)...Date(),
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .datePickerStyle(.compact)
                    .colorScheme(.dark)
                    .tint(.white)
                    .blendMode(.destinationOver)
                    .frame(width: 32, height: 32)
                    .clipped()
                }

                if isBirthDateValid {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 17))
                        .foregroundStyle(Color(hex: "#34C759"))
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.horizontal, 18)
            .frame(height: 52)
            .glassEffect(.regular, in: Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(
                        isBirthDateValid ? Color(hex: "#34C759").opacity(0.5) : .clear,
                        lineWidth: 1
                    )
            )
            .animation(.spring(response: 0.3), value: isBirthDateValid)
            .padding(.top, 28)
            .onChange(of: pickerDate) { _, new in
                let comps = Calendar.current.dateComponents([.month, .day, .year], from: new)
                if let m = comps.month { monthInput = String(format: "%02d", m) }
                if let d = comps.day { dayInput = String(format: "%02d", d) }
                if let y = comps.year { yearInput = String(y) }
                HapticManager.light()
            }
        }
        .padding(.horizontal, 24)
    }

    private var dobSlash: some View {
        Text("/")
            .font(.system(size: 17, weight: .medium, design: .rounded))
            .foregroundStyle(.white.opacity(0.25))
    }

    // MARK: - Step 3: Username

    private var usernameStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepHeader(
                title: "Pick a username",
                subtitle: "This is how you'll appear on Today+. 3–20 characters, letters/numbers/underscore."
            )

            // Username field with @ prefix
            HStack(spacing: 10) {
                Text("@")
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.45))

                TextField("", text: $username, prompt: Text("yourname").foregroundColor(.white.opacity(0.3)))
                    .focused($focusedField, equals: .username)
                    .font(.system(size: 18, weight: .medium, design: .rounded))
                    .foregroundStyle(.white)
                    .textContentType(.username)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .onChange(of: username) { _, new in
                        // Limit chars + strip invalid
                        let filtered = new.filter { $0.isLetter || $0.isNumber || $0 == "_" }
                        let capped = String(filtered.prefix(20))
                        if capped != new { username = capped }
                        viewModel.username = capped
                        viewModel.fullName = capped    // default display name = username
                    }

                if isUsernameValid {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Color(hex: "#34C759"))
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.horizontal, 20)
            .frame(height: 52)
            .glassEffect(.regular, in: Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(
                        isUsernameValid ? Color(hex: "#34C759").opacity(0.5) : .clear,
                        lineWidth: 1
                    )
            )
            .animation(.spring(response: 0.3), value: isUsernameValid)
            .padding(.top, 28)

            // Character count
            HStack {
                usernameHint
                Spacer()
                Text("\(username.count)/20")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.35))
                    .monospacedDigit()
            }
            .padding(.horizontal, 4)
            .padding(.top, 12)
        }
        .padding(.horizontal, 24)
    }

    @ViewBuilder
    private var usernameHint: some View {
        if username.isEmpty {
            Text("Letters, numbers, underscore only")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.35))
        } else if !isUsernameValid {
            HStack(spacing: 4) {
                Image(systemName: "info.circle.fill").font(.system(size: 11))
                Text(username.count < 3 ? "Too short (min 3)" : "Invalid characters")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
            }
            .foregroundStyle(Color(hex: "#FF9F0A"))
        } else {
            HStack(spacing: 4) {
                Image(systemName: "checkmark").font(.system(size: 11, weight: .bold))
                Text("Looks good")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
            }
            .foregroundStyle(Color(hex: "#34C759"))
        }
    }

    // MARK: - Step 4: Password

    private var passwordStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepHeader(
                title: "Create a password",
                subtitle: "At least 6 characters. Mix letters, numbers, and symbols for a stronger password."
            )

            // Password input
            HStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.45))
                    .frame(width: 22)

                Group {
                    if showPassword {
                        TextField("", text: $viewModel.password, prompt: Text("password").foregroundColor(.white.opacity(0.3)))
                    } else {
                        SecureField("", text: $viewModel.password, prompt: Text("password").foregroundColor(.white.opacity(0.3)))
                    }
                }
                .focused($focusedField, equals: .password)
                .textContentType(.newPassword)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundStyle(.white)

                Button {
                    showPassword.toggle()
                    HapticManager.light()
                } label: {
                    Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(.white.opacity(0.45))
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
            }
            .padding(.horizontal, 20)
            .frame(height: 52)
            .glassEffect(.regular, in: Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(
                        viewModel.isPasswordValid ? Color(hex: "#34C759").opacity(0.5) : .clear,
                        lineWidth: 1
                    )
            )
            .animation(.spring(response: 0.3), value: viewModel.isPasswordValid)
            .padding(.top, 28)

            // Strength meter
            passwordStrengthMeter
                .padding(.top, 14)

            // Requirements
            passwordRequirements
                .padding(.top, 14)
        }
        .padding(.horizontal, 24)
    }

    private var passwordStrengthMeter: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                ForEach(0..<4, id: \.self) { i in
                    Capsule()
                        .fill(
                            i < passwordStrength.level ? passwordStrength.color : Color.white.opacity(0.12)
                        )
                        .frame(height: 4)
                        .animation(.spring(response: 0.35), value: passwordStrength.level)
                }
            }
            Text(passwordStrength.label)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(passwordStrength.color)
                .animation(.easeInOut(duration: 0.2), value: passwordStrength.label)
        }
    }

    private var passwordRequirements: some View {
        VStack(alignment: .leading, spacing: 8) {
            requirement("At least 6 characters", met: viewModel.password.count >= 6)
            requirement("Contains a number", met: viewModel.password.contains(where: \.isNumber))
            requirement("Contains a symbol", met: viewModel.password.contains(where: { "!@#$%^&*()_+-={}[]:;\"'<>,.?/\\|`~".contains($0) }))
        }
    }

    private func requirement(_ text: String, met: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: met ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(met ? Color(hex: "#34C759") : .white.opacity(0.25))
            Text(text)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(met ? .white.opacity(0.85) : .white.opacity(0.45))
            Spacer()
        }
        .animation(.easeOut(duration: 0.2), value: met)
    }

    // MARK: - Shared components

    private func stepHeader(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .tracking(-0.8)
                .fixedSize(horizontal: false, vertical: true)

            Text(subtitle)
                .font(.system(size: 15, weight: .regular, design: .rounded))
                .foregroundStyle(.white.opacity(0.5))
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func inputField(
        icon: String,
        placeholder: String,
        text: Binding<String>,
        validated: Bool,
        keyboard: UIKeyboardType = .default,
        contentType: UITextContentType? = nil,
        field: Field
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.45))
                .frame(width: 22)

            TextField("", text: text, prompt: Text(placeholder).foregroundColor(.white.opacity(0.3)))
                .focused($focusedField, equals: field)
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundStyle(.white)
                .keyboardType(keyboard)
                .textContentType(contentType)
                .autocorrectionDisabled()
                .textInputAutocapitalization(keyboard == .emailAddress ? .never : .sentences)

            if validated {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 17))
                    .foregroundStyle(Color(hex: "#34C759"))
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, 20)
        .frame(height: 52)
        .glassEffect(.regular, in: Capsule())
        .overlay(
            Capsule()
                .strokeBorder(
                    validated ? Color(hex: "#34C759").opacity(0.5) : .clear,
                    lineWidth: 1
                )
        )
        .animation(.spring(response: 0.3), value: validated)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 13))
            Text(text)
                .font(.system(size: 13, weight: .medium))
                .lineLimit(2)
        }
        .foregroundStyle(Color(hex: "#FF453A"))
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color(hex: "#FF453A").opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(.horizontal, 24)
    }

    private var continueButton: some View {
        Button {
            HapticManager.medium()
            handleContinue()
        } label: {
            HStack(spacing: 8) {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(.black)
                        .scaleEffect(0.9)
                } else {
                    Text(step == .password ? "Create Account" : "Continue")
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .tracking(-0.2)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .bold))
                }
            }
            .foregroundStyle(canProceed ? .black : .black.opacity(0.45))
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(
                canProceed ? Color.white : Color.white.opacity(0.6),
                in: RoundedRectangle(cornerRadius: 27, style: .continuous)
            )
            .shadow(color: canProceed ? .white.opacity(0.25) : .clear, radius: 20, y: 8)
        }
        .buttonStyle(PressScale())
        .disabled(!canProceed || viewModel.isLoading)
        .animation(.spring(response: 0.3), value: canProceed)
    }

    private var loginSwitchFooter: some View {
        HStack(spacing: 4) {
            Text("Already have an account?")
                .foregroundStyle(.white.opacity(0.5))
            Button {
                onShowLogin?()
            } label: {
                Text("Sign In")
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
            }
        }
        .font(.system(size: 14, design: .rounded))
        .frame(maxWidth: .infinity)
    }

    // MARK: - Actions

    private func handleContinue() {
        switch step {
        case .email, .age, .username:
            if let next = SignupStep(rawValue: step.rawValue + 1) {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
                    step = next
                }
            }
        case .password:
            // Push captured fields into the viewmodel before signup fires
            viewModel.username = username
            viewModel.fullName = username
            viewModel.birthDate = computedBirthDate
            Task {
                if let result = await viewModel.signup() {
                    onSignup?(result.user, result.session)
                }
            }
        }
    }
}

// MARK: - Password Strength

private struct PasswordStrength {
    let level: Int     // 0-4
    let label: String
    let color: Color

    static func compute(_ pw: String) -> PasswordStrength {
        guard !pw.isEmpty else { return .init(level: 0, label: " ", color: .clear) }

        var score = 0
        if pw.count >= 6 { score += 1 }
        if pw.count >= 10 { score += 1 }
        if pw.contains(where: \.isNumber) { score += 1 }
        if pw.contains(where: \.isUppercase) { score += 1 }
        if pw.contains(where: { "!@#$%^&*()_+-={}[]:;\"'<>,.?/\\|`~".contains($0) }) { score += 1 }

        let level = min(4, max(1, score))
        switch level {
        case 1: return .init(level: 1, label: "Weak", color: Color(hex: "#FF453A"))
        case 2: return .init(level: 2, label: "Fair", color: Color(hex: "#FF9F0A"))
        case 3: return .init(level: 3, label: "Good", color: Color(hex: "#FFD60A"))
        default: return .init(level: 4, label: "Strong", color: Color(hex: "#34C759"))
        }
    }
}

// MARK: - Button press style

private struct PressScale: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: - Signup starfield (subtle twinkling stars on pure black)

private struct SignupStarfield: View {
    let time: Double

    private struct Star {
        let x: Double
        let y: Double
        let size: CGFloat
        let baseOpacity: Double
        let twinkleFreq: Double
        let twinklePhase: Double
    }

    private static let stars: [Star] = {
        var rng = SignupRNG(seed: 9917)
        return (0..<50).map { _ in
            Star(
                x: Double.random(in: 0...1, using: &rng),
                y: Double.random(in: 0...1, using: &rng),
                size: CGFloat.random(in: 0.8...2.2, using: &rng),
                baseOpacity: Double.random(in: 0.2...0.7, using: &rng),
                twinkleFreq: Double.random(in: 1.2...3.0, using: &rng),
                twinklePhase: Double.random(in: 0...6.28, using: &rng)
            )
        }
    }()

    var body: some View {
        Canvas { ctx, size in
            for s in Self.stars {
                let twinkle = 0.55 + (sin(time * s.twinkleFreq + s.twinklePhase) + 1) * 0.225
                let rect = CGRect(
                    x: s.x * size.width - s.size / 2,
                    y: s.y * size.height - s.size / 2,
                    width: s.size,
                    height: s.size
                )
                ctx.fill(Path(ellipseIn: rect), with: .color(.white.opacity(s.baseOpacity * twinkle)))
            }
        }
    }
}

private struct SignupRNG: RandomNumberGenerator {
    var state: UInt64
    init(seed: UInt64) { state = seed == 0 ? 1 : seed }
    mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return state
    }
}

// MARK: - DoB segment (catches backspace on empty)

final class BackspaceTextField: UITextField {
    var onBackspaceEmpty: (() -> Void)?

    override func deleteBackward() {
        let wasEmpty = (text ?? "").isEmpty
        super.deleteBackward()
        if wasEmpty { onBackspaceEmpty?() }
    }
}

struct DobSegment: UIViewRepresentable {
    @Binding var text: String
    let placeholder: String
    let maxLength: Int
    let isFocused: Bool
    let onFocus: () -> Void
    let onFilled: () -> Void
    let onBackspaceEmpty: () -> Void

    func makeUIView(context: Context) -> BackspaceTextField {
        let tf = BackspaceTextField()
        tf.delegate = context.coordinator
        tf.keyboardType = .numberPad
        tf.textAlignment = .center
        tf.tintColor = .white
        tf.textColor = .white

        let base = UIFont.systemFont(ofSize: 16, weight: .medium)
        let rounded = base.fontDescriptor.withDesign(.rounded).map { UIFont(descriptor: $0, size: 16) } ?? base
        tf.font = rounded
        tf.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [
                .foregroundColor: UIColor.white.withAlphaComponent(0.3),
                .font: rounded
            ]
        )
        tf.onBackspaceEmpty = onBackspaceEmpty
        tf.addTarget(context.coordinator, action: #selector(Coordinator.changed(_:)), for: .editingChanged)
        tf.setContentHuggingPriority(.defaultLow, for: .horizontal)
        return tf
    }

    func updateUIView(_ view: BackspaceTextField, context: Context) {
        context.coordinator.parent = self
        view.onBackspaceEmpty = onBackspaceEmpty
        if view.text != text { view.text = text }
        DispatchQueue.main.async {
            if isFocused, !view.isFirstResponder {
                view.becomeFirstResponder()
            } else if !isFocused, view.isFirstResponder {
                view.resignFirstResponder()
            }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: DobSegment
        init(parent: DobSegment) { self.parent = parent }

        @objc func changed(_ sender: UITextField) {
            let raw = sender.text ?? ""
            let filtered = String(raw.filter(\.isNumber).prefix(parent.maxLength))
            if filtered != raw { sender.text = filtered }
            if parent.text != filtered { parent.text = filtered }
            if filtered.count == parent.maxLength {
                parent.onFilled()
            }
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            parent.onFocus()
        }
    }
}

#Preview {
    NavigationStack {
        SignupView()
    }
}
