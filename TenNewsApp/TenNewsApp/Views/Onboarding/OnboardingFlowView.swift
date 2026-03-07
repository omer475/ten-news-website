import SwiftUI

struct OnboardingFlowView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var viewModel = OnboardingViewModel()
    @State private var showSignIn = false
    @State private var showSignUp = false
    @State private var searchText = ""
    @State private var orbPhase: CGFloat = 0

    private var accent: Color { TimeOfDay.current.accentColor }

    var body: some View {
        ZStack {
            // Deep gradient background
            LinearGradient(
                stops: [
                    .init(color: Color(hex: "#0a0a1a"), location: 0),
                    .init(color: Color(hex: "#111128"), location: 0.4),
                    .init(color: Color(hex: "#1a1035"), location: 0.7),
                    .init(color: Color(hex: "#0d0d20"), location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Ambient orbs
            GeometryReader { geo in
                Circle()
                    .fill(accent.opacity(0.12))
                    .frame(width: 300, height: 300)
                    .blur(radius: 100)
                    .offset(
                        x: geo.size.width * 0.3 + sin(orbPhase * 0.5) * 25,
                        y: geo.size.height * 0.08 + cos(orbPhase * 0.4) * 15
                    )
                Circle()
                    .fill(Color.purple.opacity(0.08))
                    .frame(width: 250, height: 250)
                    .blur(radius: 90)
                    .offset(
                        x: -geo.size.width * 0.15 + cos(orbPhase * 0.6) * 30,
                        y: geo.size.height * 0.55 + sin(orbPhase * 0.7) * 20
                    )
            }
            .ignoresSafeArea()

            switch viewModel.currentStep {
            case .welcome:
                WelcomeScene(accent: accent, onContinue: {
                    viewModel.nextStep()
                }, onSignIn: {
                    showSignIn = true
                }, onGuest: {
                    appViewModel.continueAsGuest()
                })
                .transition(.asymmetric(insertion: .opacity, removal: .push(from: .leading)))
            case .country:
                selectionScene(
                    step: 1,
                    title: "Where are you",
                    titleAccent: "based?",
                    subtitle: "We'll prioritize news from your region"
                ) { countryGrid(single: true) }
            case .countries:
                selectionScene(
                    step: 2,
                    title: "Follow more",
                    titleAccent: "countries",
                    subtitle: "\(viewModel.selectedCountries.count) selected",
                    showSkip: true
                ) { countryGrid(single: false) }
            case .topics:
                selectionScene(
                    step: 3,
                    title: "What gets you",
                    titleAccent: "excited?",
                    subtitle: topicSubtitle
                ) { topicGrid }
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 14).repeatForever(autoreverses: true)) {
                orbPhase = .pi * 2
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showSignIn) { signInSheet }
        .sheet(isPresented: $showSignUp) { signUpSheet }
        .onAppear { handleDebugLaunch() }
    }

    private func handleDebugLaunch() {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--screenshot-step-1") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                viewModel.debugJumpTo(.country)
            }
        } else if args.contains("--screenshot-step-2") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                viewModel.debugJumpTo(.countries)
            }
        } else if args.contains("--screenshot-step-3") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                viewModel.debugJumpTo(.topics)
            }
        }
    }

    private var topicSubtitle: String {
        let c = viewModel.selectedTopics.count
        return c < 3 ? "Pick at least \(3 - c) more" : "\(c) selected"
    }

    // MARK: - Selection Scene Template

    private func selectionScene<Content: View>(
        step: Int,
        title: String,
        titleAccent: String,
        subtitle: String,
        showSkip: Bool = false,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(spacing: 0) {
            // Top bar
            HStack {
                Button {
                    viewModel.previousStep()
                    HapticManager.light()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.7))
                        .frame(width: 36, height: 36)
                        .background(.white.opacity(0.08), in: Circle())
                }

                Spacer()

                // Progress bar
                HStack(spacing: 4) {
                    ForEach(1...3, id: \.self) { i in
                        Capsule()
                            .fill(i <= step ? accent : .white.opacity(0.15))
                            .frame(width: i == step ? 20 : 6, height: 4)
                    }
                }

                Spacer()
                Color.clear.frame(width: 36, height: 36)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            // Title block
            VStack(alignment: .leading, spacing: 4) {
                TypingTextView(fullText: title, typingSpeed: 0.03, startDelay: 0.15)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(.white)
                    .tracking(-0.5)

                TypingTextView(fullText: titleAccent, typingSpeed: 0.04, startDelay: 0.6)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(accent)
                    .tracking(-0.5)

                Text(subtitle)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.45))
                    .padding(.top, 4)
                    .onboardSlideIn(delay: 1.2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.top, 14)

            // Content
            content()
                .onboardSlideIn(delay: 1.3)

            // Bottom CTA
            HStack(spacing: 10) {
                if showSkip {
                    Button {
                        viewModel.nextStep()
                        HapticManager.light()
                    } label: {
                        Text("Skip")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.5))
                            .frame(height: 54)
                            .frame(maxWidth: .infinity)
                            .background(.white.opacity(0.06), in: Capsule())
                            .overlay(Capsule().stroke(.white.opacity(0.08), lineWidth: 1))
                    }
                }

                Button {
                    if viewModel.isLastStep { showSignUp = true }
                    else { viewModel.nextStep() }
                    HapticManager.medium()
                } label: {
                    HStack(spacing: 6) {
                        Text(viewModel.isLastStep ? "Let's Go" : "Continue")
                            .font(.system(size: 17, weight: .bold))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(viewModel.canProceed ? .white : .white.opacity(0.3))
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(
                        viewModel.canProceed
                            ? AnyShapeStyle(accent.gradient)
                            : AnyShapeStyle(Color.white.opacity(0.06)),
                        in: Capsule()
                    )
                    .overlay {
                        if viewModel.canProceed {
                            Capsule().stroke(.white.opacity(0.2), lineWidth: 1)
                        } else {
                            Capsule().stroke(.white.opacity(0.06), lineWidth: 1)
                        }
                    }
                }
                .disabled(!viewModel.canProceed)

                if viewModel.isLastStep {
                    Button {
                        HapticManager.light()
                        let prefs = viewModel.buildPreferences()
                        appViewModel.continueAsGuest(with: prefs)
                    } label: {
                        Text("Continue as Guest")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white.opacity(0.5))
                            .frame(height: 36)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
            .animation(.spring(response: 0.3), value: viewModel.canProceed)
        }
        .transition(.asymmetric(insertion: .push(from: .trailing), removal: .push(from: .leading)))
    }

    // MARK: - Country Grid

    private func countryGrid(single: Bool) -> some View {
        ScrollView(showsIndicators: false) {
            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: 10),
                    GridItem(.flexible(), spacing: 10),
                    GridItem(.flexible(), spacing: 10),
                ],
                spacing: 10
            ) {
                ForEach(viewModel.availableCountries) { country in
                    let isSelected = single
                        ? viewModel.selectedCountry == country.id
                        : viewModel.selectedCountries.contains(country.id)
                    let isHome = !single && country.id == viewModel.selectedCountry

                    DarkCountryCard(
                        country: country,
                        isSelected: isSelected,
                        isHome: isHome,
                        accent: accent
                    ) {
                        if single {
                            viewModel.selectCountry(country.id)
                        } else if !isHome {
                            viewModel.toggleCountry(country.id)
                        }
                    }
                    .opacity(isHome ? 0.5 : 1)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 16)
        }
    }

    // MARK: - Topic Grid

    private var topicGrid: some View {
        VStack(spacing: 0) {
            // Search
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.35))
                TextField("Search topics...", text: $searchText)
                    .font(.system(size: 15))
                    .foregroundStyle(.white)
                    .autocorrectionDisabled()
                if !searchText.isEmpty {
                    Button { searchText = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(.white.opacity(0.3))
                    }
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 42)
            .background(.white.opacity(0.06), in: Capsule())
            .overlay(Capsule().stroke(.white.opacity(0.08), lineWidth: 1))
            .padding(.horizontal, 20)
            .padding(.top, 12)

            ScrollView(showsIndicators: false) {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                    spacing: 10
                ) {
                    ForEach(filteredTopics) { topic in
                        let sel = viewModel.selectedTopics.contains(topic.id)
                        DarkTopicCard(
                            topic: topic,
                            gradient: topicGradient(for: topic.id),
                            isSelected: sel
                        ) {
                            viewModel.toggleTopic(topic.id)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 14)
                .padding(.bottom, 16)
            }
        }
    }

    private var filteredTopics: [Topic] {
        if searchText.isEmpty { return viewModel.availableTopics }
        return viewModel.availableTopics.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    private func topicGradient(for id: String) -> [Color] {
        switch id {
        case "politics":       return [Color(hex: "#1e3a6e"), Color(hex: "#4a6cf7")]
        case "economy":        return [Color(hex: "#0d5e4a"), Color(hex: "#10b981")]
        case "technology":     return [Color(hex: "#5b21b6"), Color(hex: "#8b5cf6")]
        case "science":        return [Color(hex: "#6d28d9"), Color(hex: "#c084fc")]
        case "health":         return [Color(hex: "#9f1239"), Color(hex: "#fb7185")]
        case "environment":    return [Color(hex: "#065f46"), Color(hex: "#34d399")]
        case "business":       return [Color(hex: "#1e293b"), Color(hex: "#475569")]
        case "defense":        return [Color(hex: "#374151"), Color(hex: "#6b7280")]
        case "diplomacy":      return [Color(hex: "#155e75"), Color(hex: "#22d3ee")]
        case "energy":         return [Color(hex: "#92400e"), Color(hex: "#fbbf24")]
        case "ai":             return [Color(hex: "#3730a3"), Color(hex: "#818cf8")]
        case "space":          return [Color(hex: "#1e1b4b"), Color(hex: "#6366f1")]
        case "cybersecurity":  return [Color(hex: "#134e4a"), Color(hex: "#2dd4bf")]
        case "trade":          return [Color(hex: "#44403c"), Color(hex: "#a8a29e")]
        case "climate":        return [Color(hex: "#14532d"), Color(hex: "#4ade80")]
        case "human_rights":   return [Color(hex: "#9a3412"), Color(hex: "#fb923c")]
        case "migration":      return [Color(hex: "#0c4a6e"), Color(hex: "#38bdf8")]
        case "education":      return [Color(hex: "#78350f"), Color(hex: "#d97706")]
        case "finance":        return [Color(hex: "#713f12"), Color(hex: "#facc15")]
        case "crypto":         return [Color(hex: "#9a3412"), Color(hex: "#f97316")]
        case "sports":         return [Color(hex: "#991b1b"), Color(hex: "#f87171")]
        case "entertainment":  return [Color(hex: "#831843"), Color(hex: "#f472b6")]
        case "culture":        return [Color(hex: "#701a75"), Color(hex: "#e879f9")]
        case "conflict":       return [Color(hex: "#1f2937"), Color(hex: "#6b7280")]
        case "disaster":       return [Color(hex: "#7f1d1d"), Color(hex: "#ef4444")]
        case "law":            return [Color(hex: "#1e3a5f"), Color(hex: "#60a5fa")]
        case "transportation": return [Color(hex: "#292524"), Color(hex: "#78716c")]
        case "agriculture":    return [Color(hex: "#365314"), Color(hex: "#84cc16")]
        case "infrastructure": return [Color(hex: "#3f3f46"), Color(hex: "#a1a1aa")]
        default:               return [Color(hex: "#374151"), Color(hex: "#9ca3af")]
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
                    viewModel.nextStep()
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
                    showSignIn = true
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

            // Brand
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
                    // Feature badges
                    HStack(spacing: 8) {
                        badge(icon: "brain", text: "AI-Powered")
                        badge(icon: "person.fill", text: "Personalized")
                        badge(icon: "bolt.fill", text: "Real-time")
                    }
                    .padding(.bottom, 6)

                    // CTA
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
                            .overlay(Capsule().stroke(.white.opacity(0.2), lineWidth: 1))
                    }

                    // Continue as Guest
                    Button {
                        HapticManager.light()
                        onGuest?()
                    } label: {
                        Text("Continue as Guest")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.7))
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(.white.opacity(0.06), in: Capsule())
                            .overlay(Capsule().stroke(.white.opacity(0.1), lineWidth: 1))
                    }

                    Button {
                        HapticManager.light()
                        onSignIn()
                    } label: {
                        HStack(spacing: 4) {
                            Text("Already have an account?")
                                .foregroundStyle(.white.opacity(0.35))
                            Text("Sign In")
                                .foregroundStyle(.white.opacity(0.7))
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

    private func badge(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
            Text(text)
                .font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(.white.opacity(0.45))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.white.opacity(0.06), in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.08), lineWidth: 1))
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

// MARK: - Country Card (dark glass)

private struct DarkCountryCard: View {
    let country: Country
    let isSelected: Bool
    var isHome: Bool = false
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button {
            HapticManager.light()
            action()
        } label: {
            VStack(spacing: 6) {
                Text(country.flag)
                    .font(.system(size: 40))

                Text(country.name)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(isSelected ? 1.0 : 0.6))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 100)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(isSelected ? accent.opacity(0.15) : .white.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(isSelected ? accent.opacity(0.5) : .white.opacity(0.06), lineWidth: isSelected ? 1.5 : 1)
            )
            .overlay(alignment: .topTrailing) {
                if isSelected {
                    ZStack {
                        Circle().fill(accent).frame(width: 20, height: 20)
                        Image(systemName: "checkmark")
                            .font(.system(size: 9, weight: .black))
                            .foregroundStyle(.white)
                    }
                    .offset(x: -8, y: 8)
                    .transition(.scale.combined(with: .opacity))
                }
            }
        }
        .buttonStyle(DarkTileBounce())
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
    }
}

// MARK: - Topic Card (dark gradient)

private struct DarkTopicCard: View {
    let topic: Topic
    let gradient: [Color]
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button {
            HapticManager.light()
            action()
        } label: {
            ZStack(alignment: .bottomLeading) {
                // Gradient bg
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: isSelected ? gradient : [gradient[0].opacity(0.4), gradient[1].opacity(0.2)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                // Dark overlay when not selected
                if !isSelected {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(.black.opacity(0.3))
                }

                // Content
                VStack(alignment: .leading, spacing: 6) {
                    Spacer()

                    Image(systemName: topic.icon)
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(.white.opacity(isSelected ? 0.95 : 0.5))

                    Text(topic.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white.opacity(isSelected ? 1.0 : 0.6))
                        .lineLimit(1)
                }
                .padding(14)

                // Check
                if isSelected {
                    VStack {
                        HStack {
                            Spacer()
                            ZStack {
                                Circle().fill(.white).frame(width: 22, height: 22)
                                Image(systemName: "checkmark")
                                    .font(.system(size: 10, weight: .black))
                                    .foregroundStyle(gradient[0])
                            }
                            .padding(10)
                        }
                        Spacer()
                    }
                    .transition(.scale.combined(with: .opacity))
                }
            }
            .frame(height: 110)
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(
                        isSelected ? .white.opacity(0.25) : .white.opacity(0.05),
                        lineWidth: 1
                    )
            )
            .shadow(
                color: isSelected ? gradient[1].opacity(0.3) : .clear,
                radius: 16, y: 6
            )
        }
        .buttonStyle(DarkTileBounce())
        .animation(.spring(response: 0.3, dampingFraction: 0.65), value: isSelected)
    }
}

// MARK: - Button Style

private struct DarkTileBounce: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.65), value: configuration.isPressed)
    }
}

// MARK: - Slide-in Modifier

private struct OnboardSlideIn: ViewModifier {
    let delay: Double
    @State private var visible = false

    func body(content: Content) -> some View {
        content
            .opacity(visible ? 1 : 0)
            .offset(y: visible ? 0 : 16)
            .animation(.spring(response: 0.5, dampingFraction: 0.8), value: visible)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { visible = true }
            }
    }
}

private extension View {
    func onboardSlideIn(delay: Double) -> some View {
        modifier(OnboardSlideIn(delay: delay))
    }
}

#Preview {
    OnboardingFlowView()
        .environment(AppViewModel())
}
