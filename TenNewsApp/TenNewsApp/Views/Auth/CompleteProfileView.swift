import SwiftUI

/// Shown after Google OAuth when the user hasn't set a username + date of birth yet.
/// Collects both with the same UI language as the signup flow, then hits
/// `/api/auth/complete-profile` via AuthViewModel.completeProfile().
struct CompleteProfileView: View {
    @Bindable var viewModel: AuthViewModel

    @State private var step: Step = .age
    @State private var dayInput: String = ""
    @State private var monthInput: String = ""
    @State private var yearInput: String = ""
    @State private var pickerDate: Date = Calendar.current.date(byAdding: .year, value: -22, to: Date()) ?? Date()
    @State private var dobFocus: DobField?
    @State private var usernameInput: String = ""
    @FocusState private var usernameFocused: Bool

    var onComplete: (AuthUser) -> Void

    enum Step: Int, CaseIterable { case age, username }
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
        let trimmed = usernameInput.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 3, trimmed.count <= 20 else { return false }
        return trimmed.range(of: "^[a-zA-Z0-9_]+$", options: .regularExpression) != nil
    }

    private var canProceed: Bool {
        switch step {
        case .age: return isBirthDateValid
        case .username: return isUsernameValid
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                progressDots
                    .padding(.top, 6)
                    .padding(.bottom, 20)
                Group {
                    switch step {
                    case .age:      ageStep
                    case .username: usernameStep
                    }
                }
                .transition(stepTransition)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)

                if let error = viewModel.errorMessage {
                    errorBanner(error)
                        .padding(.bottom, 8)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                continueButton
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)
                Color.clear.frame(height: 20)
            }
            .padding(.top, 8)
        }
        .background(Color.black)
        .scrollDismissesKeyboard(.interactively)
        .onAppear { dobFocus = .day }
        .onChange(of: step) { _, _ in
            viewModel.clearMessages()
        }
    }

    private var stepTransition: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .trailing).combined(with: .opacity),
            removal: .move(edge: .leading).combined(with: .opacity)
        )
    }

    private var topBar: some View {
        HStack {
            Button {
                HapticManager.light()
                if step == .age { return } // no back from age — google session already started
                if let prev = Step(rawValue: step.rawValue - 1) {
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
                        step = prev
                    }
                }
            } label: {
                Image(systemName: step == .age ? "person.crop.circle" : "chevron.left")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white.opacity(step == .age ? 0.4 : 0.8))
                    .frame(width: 38, height: 38)
                    .background(.white.opacity(0.1), in: Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(0.12), lineWidth: 1))
            }
            .disabled(step == .age)

            Spacer()
            Text("Complete your profile")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.4))
            Spacer()

            Color.clear.frame(width: 38, height: 38)
        }
        .padding(.horizontal, 20)
    }

    private var progressDots: some View {
        HStack(spacing: 6) {
            ForEach(Step.allCases, id: \.rawValue) { s in
                Capsule()
                    .fill(s.rawValue <= step.rawValue ? Color.white : Color.white.opacity(0.18))
                    .frame(width: s == step ? 28 : 6, height: 6)
                    .animation(.spring(response: 0.5, dampingFraction: 0.8), value: step)
            }
        }
    }

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
                    text: $dayInput, placeholder: "DD", maxLength: 2,
                    isFocused: dobFocus == .day,
                    onFocus: { dobFocus = .day },
                    onFilled: { dobFocus = .month },
                    onBackspaceEmpty: {}
                ).frame(width: 40, height: 36)
                dobSlash
                DobSegment(
                    text: $monthInput, placeholder: "MM", maxLength: 2,
                    isFocused: dobFocus == .month,
                    onFocus: { dobFocus = .month },
                    onFilled: { dobFocus = .year },
                    onBackspaceEmpty: { dobFocus = .day }
                ).frame(width: 40, height: 36)
                dobSlash
                DobSegment(
                    text: $yearInput, placeholder: "YYYY", maxLength: 4,
                    isFocused: dobFocus == .year,
                    onFocus: { dobFocus = .year },
                    onFilled: {},
                    onBackspaceEmpty: { dobFocus = .month }
                ).frame(width: 64, height: 36)

                Spacer(minLength: 0)

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
                Capsule().strokeBorder(
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

    private var usernameStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepHeader(
                title: "Pick a username",
                subtitle: "This is how you'll appear on Today+. 3–20 characters, letters/numbers/underscore."
            )

            HStack(spacing: 10) {
                Text("@")
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.45))

                TextField("", text: $usernameInput, prompt: Text("yourname").foregroundColor(.white.opacity(0.3)))
                    .focused($usernameFocused)
                    .font(.system(size: 18, weight: .medium, design: .rounded))
                    .foregroundStyle(.white)
                    .textContentType(.username)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .onChange(of: usernameInput) { _, new in
                        let filtered = new.filter { $0.isLetter || $0.isNumber || $0 == "_" }
                        let capped = String(filtered.prefix(20))
                        if capped != new { usernameInput = capped }
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
                Capsule().strokeBorder(
                    isUsernameValid ? Color(hex: "#34C759").opacity(0.5) : .clear,
                    lineWidth: 1
                )
            )
            .animation(.spring(response: 0.3), value: isUsernameValid)
            .padding(.top, 28)
            .onAppear { usernameFocused = true }

            HStack {
                Spacer()
                Text("\(usernameInput.count)/20")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.35))
                    .monospacedDigit()
            }
            .padding(.horizontal, 4)
            .padding(.top, 12)
        }
        .padding(.horizontal, 24)
    }

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
                    ProgressView().tint(.black).scaleEffect(0.9)
                } else {
                    Text(step == .username ? "Finish" : "Continue")
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
        .disabled(!canProceed || viewModel.isLoading)
        .animation(.spring(response: 0.3), value: canProceed)
    }

    private func handleContinue() {
        switch step {
        case .age:
            withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
                step = .username
            }
        case .username:
            viewModel.username = usernameInput
            viewModel.fullName = usernameInput
            viewModel.birthDate = computedBirthDate
            Task {
                if let user = await viewModel.completeProfile() {
                    onComplete(user)
                }
            }
        }
    }
}
