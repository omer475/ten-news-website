import SwiftUI

struct OnboardingFlowView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var viewModel = OnboardingViewModel()
    @State private var showSignIn = false
    @State private var showSignUp = false
    @State private var contentRevealed = false

    private var accent: Color { .blue }

    var body: some View {
        ZStack {
            Color.black
                .ignoresSafeArea()

            switch viewModel.currentStep {
            case .welcome:
                welcomeView
                    .transition(.asymmetric(insertion: .opacity, removal: .push(from: .leading)))
            case .country:
                countryPage
                    .transition(.asymmetric(insertion: .push(from: .trailing), removal: .push(from: .leading)))
            case .topics:
                topicsPage
                    .transition(.asymmetric(insertion: .push(from: .trailing), removal: .push(from: .leading)))
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showSignIn) { signInSheet }
        .sheet(isPresented: $showSignUp) { signUpSheet }
        .onChange(of: viewModel.currentStep) {
            contentRevealed = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
                    contentRevealed = true
                }
            }
        }
        .onAppear { handleDebugLaunch() }
    }

    // MARK: - Welcome

    private var welcomeView: some View {
        WelcomeScene(accent: accent, onContinue: {
            goNext()
        }, onSignIn: {
            showSignIn = true
        }, onGuest: {
            goNext()
        })
    }

    // MARK: - Country Selection

    private var countryPage: some View {
        onboardingPage(
            step: 1,
            title: "Where are you from?",
            canProceed: viewModel.selectedCountry != nil,
            ctaLabel: "Continue",
            showSkip: true
        ) {
            LazyVStack(spacing: 6) {
                ForEach(viewModel.availableCountries) { country in
                    let isSelected = viewModel.selectedCountry == country.id

                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            viewModel.selectCountry(country.id)
                        }
                    } label: {
                        HStack(spacing: 14) {
                            Text(country.flag)
                                .font(.system(size: 32))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(country.name)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(.white)
                                Text(country.region)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.35))
                            }

                            Spacer()

                            if isSelected {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 22))
                                    .foregroundStyle(accent)
                                    .transition(.scale.combined(with: .opacity))
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background {
                            if isSelected {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(accent.opacity(0.15))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                                            .strokeBorder(accent.opacity(0.3), lineWidth: 1.5)
                                    )
                            } else {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(.white.opacity(0.06))
                            }
                        }
                        .contentShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(RowPressStyle())
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 120)
            .opacity(contentRevealed ? 1 : 0)
            .offset(y: contentRevealed ? 0 : 20)
            .animation(.spring(response: 0.5, dampingFraction: 0.85), value: contentRevealed)
        }
    }

    // MARK: - Topics

    private var topicsPage: some View {
        let total = viewModel.selectedTopics.count
        let minTopics = 3

        return onboardingPage(
            step: 2,
            title: "What interests you?",
            subtitle: "Pick 3 or more to personalize your feed",
            canProceed: total >= minTopics,
            ctaLabel: total < minTopics ? "Pick \(minTopics - total) more" : "Get Started",
            showSkip: false,
            isLastStep: true
        ) {
            VStack(spacing: 24) {
                ForEach(Array(TopicCategories.all.enumerated()), id: \.element.id) { index, category in
                    categorySection(category, index: index)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 160)
            .opacity(contentRevealed ? 1 : 0)
            .offset(y: contentRevealed ? 0 : 20)
            .animation(.spring(response: 0.5, dampingFraction: 0.85), value: contentRevealed)
        }
    }

    // MARK: - Category Section

    private func categorySection(_ category: TopicCategory, index: Int) -> some View {
        let tint = categoryTint(for: category.id)
        let count = viewModel.selectedCountInCategory(category)

        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: category.icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 28, height: 28)
                    .background(tint.gradient, in: RoundedRectangle(cornerRadius: 8))

                Text(category.name)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(tint)

                if count > 0 {
                    Text("\(count)/\(category.subtopics.count)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(tint.opacity(0.7))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(tint.opacity(0.15), in: Capsule())
                        .transition(.scale.combined(with: .opacity))
                }

                Spacer()
            }
            .animation(.spring(response: 0.3), value: count)

            FlowLayoutView(spacing: 8) {
                ForEach(category.subtopics) { topic in
                    topicChip(topic, tint: tint)
                }
            }
            .padding(14)
            .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private func topicChip(_ topic: Topic, tint: Color) -> some View {
        let isOn = viewModel.selectedTopics.contains(topic.id)

        return Button {
            viewModel.toggleTopic(topic.id)
        } label: {
            HStack(spacing: 5) {
                Image(systemName: isOn ? "checkmark" : topic.icon)
                    .font(.system(size: isOn ? 10 : 11, weight: .semibold))
                Text(topic.name)
                    .font(.system(size: 13, weight: .medium))
            }
            .foregroundStyle(isOn ? .white : .white.opacity(0.6))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                isOn ? tint.opacity(0.5) : .white.opacity(0.08),
                in: Capsule()
            )
            .overlay(
                Capsule().strokeBorder(isOn ? tint.opacity(0.6) : .white.opacity(0.1), lineWidth: 1)
            )
        }
        .buttonStyle(ChipPressStyle())
        .animation(.spring(response: 0.25, dampingFraction: 0.75), value: isOn)
    }

    // MARK: - Page Template

    private func onboardingPage<Content: View>(
        step: Int,
        title: String,
        subtitle: String? = nil,
        canProceed: Bool,
        ctaLabel: String,
        showSkip: Bool = false,
        isLastStep: Bool = false,
        @ViewBuilder content: () -> Content
    ) -> some View {
        ZStack(alignment: .bottom) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Nav bar
                    HStack {
                        Button {
                            viewModel.previousStep()
                            HapticManager.light()
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.7))
                                .frame(width: 36, height: 36)
                                .background(.white.opacity(0.1), in: Circle())
                        }
                        .buttonStyle(NavBackStyle())

                        Spacer()

                        HStack(spacing: 5) {
                            ForEach(1...2, id: \.self) { i in
                                Capsule()
                                    .fill(i == step ? accent : .white.opacity(0.15))
                                    .frame(width: i == step ? 20 : 6, height: 6)
                            }
                        }
                        .animation(.spring(response: 0.4), value: step)

                        Spacer()

                        if showSkip {
                            Button {
                                viewModel.nextStep()
                                HapticManager.light()
                            } label: {
                                Text("Skip")
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.35))
                            }
                            .frame(width: 36)
                        } else {
                            Color.clear.frame(width: 36, height: 36)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, 4)

                    // Title
                    VStack(alignment: .leading, spacing: 6) {
                        TypingTextView(fullText: title, typingSpeed: 0.055, startDelay: 0.2)
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(.white)
                            .tracking(-0.5)

                        if let subtitle {
                            Text(subtitle)
                                .font(.system(size: 15, weight: .regular))
                                .foregroundStyle(.white.opacity(0.4))
                                .opacity(contentRevealed ? 1 : 0)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 24)
                    .padding(.top, 10)
                    .padding(.bottom, 14)

                    // Content
                    content()
                }
            }

            // CTA button
            VStack(spacing: 8) {
                Button {
                    if isLastStep { showSignUp = true }
                    else { goNext() }
                    HapticManager.medium()
                } label: {
                    Text(ctaLabel)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(canProceed ? AnyShapeStyle(accent.gradient) : AnyShapeStyle(Color.white.opacity(0.1)))
                        }
                }
                .disabled(!canProceed)
                .buttonStyle(CTAPressStyle())
                .animation(.spring(response: 0.22), value: canProceed)

                if isLastStep {
                    Button {
                        HapticManager.light()
                        let prefs = viewModel.buildPreferences()
                        appViewModel.continueAsGuest(with: prefs)
                    } label: {
                        Text("Continue as Guest")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white.opacity(0.4))
                    }
                    .frame(height: 24)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 4)
            .opacity(contentRevealed ? 1 : 0)
            .offset(y: contentRevealed ? 0 : 20)
            .animation(.spring(response: 0.5, dampingFraction: 0.85).delay(0.1), value: contentRevealed)
        }
    }

    // MARK: - Helpers

    private func goNext() {
        viewModel.nextStep()
    }

    private func categoryTint(for id: String) -> Color {
        switch id {
        case "politics":       return Color(hex: "#5856D6")
        case "news_politics":  return Color(hex: "#5856D6")
        case "sports":         return Color(hex: "#FF9500")
        case "business":       return Color(hex: "#34C759")
        case "entertainment":  return Color(hex: "#FF2D55")
        case "tech":           return Color(hex: "#007AFF")
        case "science":        return Color(hex: "#AF52DE")
        case "health":         return Color(hex: "#FF3B30")
        case "finance":        return Color(hex: "#30B0C7")
        case "crypto":         return Color(hex: "#F7931A")
        case "lifestyle":      return Color(hex: "#A2845E")
        case "fashion":        return Color(hex: "#E91E8C")
        case "news":           return Color(hex: "#007AFF")
        default:               return .gray
        }
    }

    private func handleDebugLaunch() {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--screenshot-step-1") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { viewModel.debugJumpTo(.country) }
        } else if args.contains("--screenshot-step-2") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { viewModel.debugJumpTo(.topics) }
        }
    }

    // MARK: - Sheets

    private var signInSheet: some View {
        NavigationStack {
            LoginView(
                onLogin: { user, session in
                    appViewModel.login(user: user, session: session)
                    appViewModel.completeOnboarding(with: appViewModel.preferences)
                    showSignIn = false
                },
                onShowSignup: {
                    showSignIn = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        showSignUp = true
                    }
                }
            )
            .navigationTitle("Sign In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showSignIn = false }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(28)
    }

    private var signUpSheet: some View {
        NavigationStack {
            SignupView(
                onSignup: { user, session in
                    appViewModel.login(user: user, session: session)
                    let prefs = viewModel.buildPreferences()
                    appViewModel.completeOnboarding(with: prefs)
                    showSignUp = false
                },
                onShowLogin: {
                    showSignUp = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        showSignIn = true
                    }
                }
            )
            .navigationTitle("Create Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showSignUp = false }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(28)
    }
}

// MARK: - Welcome Scene

private struct WelcomeScene: View {
    let accent: Color
    let onContinue: () -> Void
    let onSignIn: () -> Void
    var onGuest: (() -> Void)? = nil

    @State private var phase = 0

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 12) {
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    if phase >= 1 {
                        TypingTextView(fullText: "Today", typingSpeed: 0.07, startDelay: 0)
                            .font(.system(size: 58, weight: .heavy, design: .serif))
                            .foregroundStyle(.white)
                            .tracking(-2)
                    }
                    if phase >= 2 {
                        Text("+")
                            .font(.system(size: 58, weight: .heavy, design: .serif))
                            .foregroundStyle(accent)
                            .tracking(-2)
                    }
                }

                if phase >= 3 {
                    TypingTextView(fullText: "News, reimagined.", typingSpeed: 0.04, startDelay: 0.1)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(.white.opacity(0.5))
                        .tracking(1)
                }
            }

            Spacer()

            if phase >= 4 {
                VStack(spacing: 14) {
                    HStack(spacing: 8) {
                        welcomeBadge(icon: "brain", text: "AI-Powered")
                        welcomeBadge(icon: "person.fill", text: "Personalized")
                        welcomeBadge(icon: "bolt.fill", text: "Real-time")
                    }
                    .padding(.bottom, 6)

                    Button {
                        HapticManager.medium()
                        onContinue()
                    } label: {
                        Text("Get Started")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                            .background(accent.gradient, in: Capsule())
                    }

                    Button {
                        HapticManager.light()
                        onGuest?()
                    } label: {
                        Text("Continue as Guest")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.6))
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(.white.opacity(0.08), in: Capsule())
                            .overlay(Capsule().strokeBorder(.white.opacity(0.1), lineWidth: 1))
                    }

                    Button {
                        HapticManager.light()
                        onSignIn()
                    } label: {
                        HStack(spacing: 4) {
                            Text("Already have an account?")
                                .foregroundStyle(.white.opacity(0.3))
                            Text("Sign In")
                                .foregroundStyle(.white.opacity(0.65))
                                .fontWeight(.semibold)
                        }
                        .font(.system(size: 14))
                        .frame(height: 40)
                    }
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 44)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .onAppear { run() }
    }

    private func welcomeBadge(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
            Text(text)
                .font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(.white.opacity(0.45))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.white.opacity(0.08), in: Capsule())
        .overlay(Capsule().strokeBorder(.white.opacity(0.1), lineWidth: 1))
    }

    private func run() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.75)) { phase = 1 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.6)) { phase = 2 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation(.spring(response: 0.4)) { phase = 3 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.2) {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) { phase = 4 }
        }
    }
}

// MARK: - Flow Layout

private struct FlowLayoutView: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (i, pos) in result.positions.enumerated() {
            subviews[i].place(at: CGPoint(x: bounds.minX + pos.x, y: bounds.minY + pos.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxW = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0

        for sub in subviews {
            let s = sub.sizeThatFits(.unspecified)
            if x + s.width > maxW && x > 0 {
                x = 0; y += rowH + spacing; rowH = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowH = max(rowH, s.height)
            x += s.width + spacing
        }
        return (CGSize(width: maxW, height: y + rowH), positions)
    }
}

// MARK: - Button Styles

private struct RowPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.5 : 1)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

private struct ChipPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.93 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.65), value: configuration.isPressed)
    }
}

private struct NavBackStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.88 : 1)
            .animation(.spring(response: 0.15), value: configuration.isPressed)
    }
}

private struct CTAPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    OnboardingFlowView()
        .environment(AppViewModel())
}
