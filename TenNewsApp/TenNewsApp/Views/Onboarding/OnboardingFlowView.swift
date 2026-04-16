import SwiftUI

struct OnboardingFlowView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var viewModel = OnboardingViewModel()
    @State private var showSignIn = false
    @State private var showSignUp = false
    @State private var showForgotPassword = false
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
        .sheet(isPresented: $showForgotPassword) {
            NavigationStack {
                ForgotPasswordView(onPasswordReset: { user, session in
                        appViewModel.login(user: user, session: session)
                        appViewModel.completeOnboarding(with: appViewModel.preferences)
                        showForgotPassword = false
                    })
                    .navigationTitle("Reset Password")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showForgotPassword = false }
                        }
                    }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(28)
        }
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
                        .font(.system(size: 16, weight: .semibold))
                        .tracking(-0.2)
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background {
                            RoundedRectangle(cornerRadius: 26, style: .continuous)
                                .fill(canProceed ? AnyShapeStyle(.white) : AnyShapeStyle(Color.white.opacity(0.15)))
                        }
                }
                .disabled(!canProceed)
                .buttonStyle(CTAPressStyle())
                .animation(.spring(response: 0.22), value: canProceed)
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
                },
                onShowForgotPassword: {
                    showSignIn = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        showForgotPassword = true
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

// MARK: - Animated Welcome Scene

private struct FloatingElement: Identifiable {
    let id = UUID()
    let symbol: String
    let size: CGFloat
    let x: CGFloat        // 0-1 relative position
    let y: CGFloat
    let radius: CGFloat   // drift radius in points
    let speed: Double     // seconds per full orbit
    let phase: Double     // 0-1 starting phase offset
    let opacity: Double
    let rotationSpeed: Double // degrees per second
}

private struct WelcomeScene: View {
    let accent: Color
    let onContinue: () -> Void
    let onSignIn: () -> Void

    @State private var logoVisible = false
    @State private var buttonsVisible = false

    private let elements: [FloatingElement] = [
        // News & content symbols
        FloatingElement(symbol: "newspaper.fill", size: 18, x: 0.12, y: 0.15, radius: 25, speed: 12, phase: 0.0, opacity: 0.25, rotationSpeed: 3),
        FloatingElement(symbol: "book.fill", size: 14, x: 0.85, y: 0.20, radius: 20, speed: 14, phase: 0.3, opacity: 0.20, rotationSpeed: -2),
        FloatingElement(symbol: "quote.opening", size: 16, x: 0.75, y: 0.72, radius: 22, speed: 11, phase: 0.7, opacity: 0.18, rotationSpeed: 4),
        // Globe & connectivity
        FloatingElement(symbol: "globe.americas.fill", size: 22, x: 0.88, y: 0.42, radius: 18, speed: 16, phase: 0.1, opacity: 0.20, rotationSpeed: 1),
        FloatingElement(symbol: "antenna.radiowaves.left.and.right", size: 13, x: 0.18, y: 0.68, radius: 20, speed: 10, phase: 0.5, opacity: 0.15, rotationSpeed: -3),
        // Paper planes
        FloatingElement(symbol: "paperplane.fill", size: 16, x: 0.70, y: 0.12, radius: 28, speed: 9, phase: 0.2, opacity: 0.30, rotationSpeed: 5),
        FloatingElement(symbol: "paperplane.fill", size: 12, x: 0.22, y: 0.82, radius: 22, speed: 13, phase: 0.8, opacity: 0.22, rotationSpeed: -4),
        // Stars — scattered, different sizes
        FloatingElement(symbol: "star.fill", size: 8, x: 0.92, y: 0.08, radius: 15, speed: 7, phase: 0.0, opacity: 0.45, rotationSpeed: 8),
        FloatingElement(symbol: "star.fill", size: 5, x: 0.05, y: 0.30, radius: 12, speed: 8, phase: 0.4, opacity: 0.40, rotationSpeed: -6),
        FloatingElement(symbol: "star.fill", size: 6, x: 0.48, y: 0.06, radius: 14, speed: 9, phase: 0.6, opacity: 0.35, rotationSpeed: 5),
        FloatingElement(symbol: "star.fill", size: 4, x: 0.35, y: 0.92, radius: 10, speed: 6, phase: 0.2, opacity: 0.30, rotationSpeed: -10),
        FloatingElement(symbol: "star.fill", size: 7, x: 0.65, y: 0.88, radius: 16, speed: 10, phase: 0.9, opacity: 0.28, rotationSpeed: 7),
        FloatingElement(symbol: "star.fill", size: 3, x: 0.95, y: 0.60, radius: 8, speed: 5, phase: 0.1, opacity: 0.35, rotationSpeed: 12),
        // Sparkles
        FloatingElement(symbol: "sparkle", size: 14, x: 0.55, y: 0.20, radius: 20, speed: 8, phase: 0.3, opacity: 0.35, rotationSpeed: 6),
        FloatingElement(symbol: "sparkle", size: 10, x: 0.08, y: 0.50, radius: 18, speed: 11, phase: 0.7, opacity: 0.28, rotationSpeed: -5),
        FloatingElement(symbol: "sparkle", size: 12, x: 0.42, y: 0.75, radius: 16, speed: 9, phase: 0.5, opacity: 0.25, rotationSpeed: 4),
        FloatingElement(symbol: "sparkle", size: 8, x: 0.82, y: 0.85, radius: 14, speed: 7, phase: 0.1, opacity: 0.30, rotationSpeed: -8),
        // Rockets
        FloatingElement(symbol: "location.north.fill", size: 14, x: 0.60, y: 0.28, radius: 30, speed: 10, phase: 0.4, opacity: 0.28, rotationSpeed: -3),
        FloatingElement(symbol: "location.north.fill", size: 10, x: 0.15, y: 0.45, radius: 24, speed: 12, phase: 0.8, opacity: 0.22, rotationSpeed: 2),
        // Tech/AI
        FloatingElement(symbol: "cpu.fill", size: 13, x: 0.78, y: 0.55, radius: 18, speed: 14, phase: 0.6, opacity: 0.18, rotationSpeed: 2),
        FloatingElement(symbol: "waveform", size: 15, x: 0.30, y: 0.35, radius: 20, speed: 11, phase: 0.2, opacity: 0.15, rotationSpeed: -1),
        // Moon & space
        FloatingElement(symbol: "moon.fill", size: 16, x: 0.40, y: 0.90, radius: 15, speed: 18, phase: 0.3, opacity: 0.22, rotationSpeed: 1),
        FloatingElement(symbol: "moon.stars.fill", size: 12, x: 0.92, y: 0.75, radius: 12, speed: 15, phase: 0.9, opacity: 0.18, rotationSpeed: -1),
        // Dots — ambient
        FloatingElement(symbol: "circle.fill", size: 5, x: 0.25, y: 0.55, radius: 12, speed: 13, phase: 0.1, opacity: 0.18, rotationSpeed: 0),
        FloatingElement(symbol: "circle.fill", size: 3, x: 0.68, y: 0.40, radius: 10, speed: 11, phase: 0.6, opacity: 0.15, rotationSpeed: 0),
        FloatingElement(symbol: "circle.fill", size: 4, x: 0.50, y: 0.62, radius: 8, speed: 9, phase: 0.4, opacity: 0.12, rotationSpeed: 0),
        FloatingElement(symbol: "circle.fill", size: 6, x: 0.10, y: 0.90, radius: 14, speed: 15, phase: 0.7, opacity: 0.16, rotationSpeed: 0),
        FloatingElement(symbol: "circle.fill", size: 3, x: 0.58, y: 0.48, radius: 6, speed: 8, phase: 0.9, opacity: 0.10, rotationSpeed: 0),
    ]

    var body: some View {
        // TimelineView drives continuous animation — never freezes
        TimelineView(.animation) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            GeometryReader { geo in
                ZStack {
                    // Floating elements
                    ForEach(elements) { e in
                        let angle = (t / e.speed + e.phase) * .pi * 2
                        let dx = cos(angle) * e.radius
                        let dy = sin(angle * 0.7) * e.radius // elliptical path
                        let rot = t * e.rotationSpeed

                        Image(systemName: e.symbol)
                            .font(.system(size: e.size, weight: .medium))
                            .foregroundStyle(.white.opacity(e.opacity))
                            .rotationEffect(.degrees(rot))
                            .position(
                                x: geo.size.width * e.x + dx,
                                y: geo.size.height * e.y + dy
                            )
                    }

                    // Subtle glow behind logo
                    let glowPulse = 0.03 + sin(t * 0.5) * 0.01
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [.white.opacity(glowPulse), .clear],
                                center: .center,
                                startRadius: 30,
                                endRadius: 220
                            )
                        )
                        .frame(width: 440, height: 440)
                        .position(x: geo.size.width / 2, y: geo.size.height * 0.4)

                    VStack(spacing: 0) {
                        Spacer()

                        // Logo
                        HStack(alignment: .firstTextBaseline, spacing: 0) {
                            Text("today")
                                .font(.system(size: 48, weight: .bold))
                                .foregroundStyle(.white)
                                .tracking(-1.5)
                            Text("+")
                                .font(.system(size: 48, weight: .bold))
                                .foregroundStyle(.white.opacity(0.35))
                                .tracking(-1.5)
                        }
                        .opacity(logoVisible ? 1 : 0)
                        .scaleEffect(logoVisible ? 1 : 0.92)

                        Spacer()

                        // Buttons
                        VStack(spacing: 12) {
                            Button {
                                HapticManager.medium()
                                onContinue()
                            } label: {
                                Text("Create Account")
                                    .font(.system(size: 16, weight: .semibold))
                                    .tracking(-0.2)
                                    .foregroundStyle(.black)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 52)
                                    .background(.white, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                            }

                            Button {
                                HapticManager.light()
                                onSignIn()
                            } label: {
                                Text("Sign In")
                                    .font(.system(size: 16, weight: .semibold))
                                    .tracking(-0.2)
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 52)
                                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 26, style: .continuous)
                                            .strokeBorder(.white.opacity(0.15), lineWidth: 1)
                                    )
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 50)
                        .opacity(buttonsVisible ? 1 : 0)
                        .offset(y: buttonsVisible ? 0 : 24)
                    }
                }
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.7).delay(0.15)) { logoVisible = true }
            withAnimation(.easeOut(duration: 0.5).delay(0.5)) { buttonsVisible = true }
        }
    }
}

// MARK: - Flow Layout

struct FlowLayoutView: Layout {
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
