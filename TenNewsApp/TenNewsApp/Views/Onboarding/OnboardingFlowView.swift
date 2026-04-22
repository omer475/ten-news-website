import SwiftUI

struct OnboardingFlowView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var viewModel = OnboardingViewModel()
    @State private var showSignIn = false
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
            case .topics:
                topicsPage
                    .transition(.asymmetric(insertion: .push(from: .trailing), removal: .push(from: .leading)))
            case .signup:
                inlineSignupView
                    .transition(.asymmetric(insertion: .push(from: .trailing), removal: .push(from: .leading)))
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showSignIn) { signInSheet }
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

    // MARK: - Topics

    private var topicsPage: some View {
        let total = viewModel.selectedTopics.count
        let minTopics = 3

        return onboardingPage(
            step: 1,
            title: "What interests you?",
            subtitle: "Pick 3 or more to personalize your feed",
            canProceed: total >= minTopics,
            ctaLabel: total < minTopics ? "Pick \(minTopics - total) more" : "Continue",
            showSkip: false,
            isLastStep: false
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

                        Capsule()
                            .fill(accent)
                            .frame(width: 20, height: 6)

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
                    goNext()
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
                                .fill(canProceed ? AnyShapeStyle(.white) : AnyShapeStyle(Color.white.opacity(0.7)))
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
        if args.contains("--screenshot-step-1") || args.contains("--screenshot-step-2") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { viewModel.debugJumpTo(.topics) }
        }
        if args.contains("--screenshot-signup") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { viewModel.debugJumpTo(.signup) }
        }
        if args.contains("--screenshot-signup-age") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { viewModel.debugJumpTo(.signup) }
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
                        viewModel.currentStep = .signup
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

    private var inlineSignupView: some View {
        SignupView(
            onSignup: { user, session in
                appViewModel.login(user: user, session: session)
                let prefs = viewModel.buildPreferences()
                appViewModel.completeOnboarding(with: prefs)
            },
            onShowLogin: {
                showSignIn = true
            },
            onBack: {
                viewModel.previousStep()
            }
        )
    }
}

// MARK: - Welcome Scene

private struct WelcomeScene: View {
    let accent: Color
    let onContinue: () -> Void
    let onSignIn: () -> Void

    @State private var logoProgress: Double = 0   // 0→1 drives letter reveal
    @State private var haloVisible = false
    @State private var chipsVisible = false
    @State private var phraseIndex = 0
    @State private var taglineVisible = false
    @State private var buttonsVisible = false

    private let logoLetters: [String] = ["t", "o", "d", "a", "y"]

    @State private var cardIndex = 0
    @State private var articles: [ExploreTopicArticle] = []
    @State private var articleColors: [String: Color] = [:]   // keyed by article id
    @State private var articleEntities: [String: String] = [:] // article id -> topic display title
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // Ambient color wash — tints the whole screen toward the current card's dominant color
            ambientColorWash
                .ignoresSafeArea()
                .animation(.smooth(duration: 1.0), value: currentArticleColor)

            VStack(spacing: 0) {
                // Fixed-height welcome slot — text bottom-anchored so 2-row entity
                // names grow upward while the entity baseline (and the card below)
                // stay in the same spot.
                welcomeBlock
                    .frame(maxWidth: .infinity, alignment: .bottomLeading)
                    .frame(height: 170, alignment: .bottomLeading)
                    .padding(.horizontal, 24)
                    .padding(.top, 40)

                // Fixed gap, then the card — its top edge is now at a constant y.
                feedCardStack
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
                    .opacity(taglineVisible ? 1 : 0)
                    .blur(radius: taglineVisible ? 0 : 14)

                Spacer()

                buttonStack
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
            }
        }
        .onAppear {
            runEntryAnimation()
            Task { await fetchArticles() }
        }
        .onReceive(Timer.publish(every: 4.0, on: .main, in: .common).autoconnect()) { _ in
            guard taglineVisible, articles.count > 1 else { return }
            withAnimation(.smooth(duration: 0.9)) {
                cardIndex = (cardIndex + 1) % articles.count
            }
        }
    }

    private func fetchArticles() async {
        let guestId = UserDefaults.standard.string(forKey: "guest_device_id") ?? {
            let newId = UUID().uuidString
            UserDefaults.standard.set(newId, forKey: "guest_device_id")
            return newId
        }()
        let endpoint = "/api/explore/topics?guest_device_id=\(guestId)"
        do {
            let response: ExploreTopicsResponse = try await APIClient.shared.get(endpoint)
            // For each article, assign it to the topic with the highest weight that
            // contains it — keeps all articles in the pool while avoiding the
            // mismatch where an article shows up under a secondary topic.
            var bestTopic: [String: (title: String, weight: Double)] = [:]
            for topic in response.topics {
                let w = topic.weight ?? 0
                for article in topic.articles where article.imageUrl != nil {
                    let key = article.id.stringValue
                    if let current = bestTopic[key], current.weight >= w { continue }
                    bestTopic[key] = (topic.displayTitle, w)
                }
            }

            var pool: [ExploreTopicArticle] = []
            var entityMap: [String: String] = [:]
            var seenIDs = Set<String>()
            for topic in response.topics {
                for article in topic.articles where article.imageUrl != nil {
                    let key = article.id.stringValue
                    if seenIDs.contains(key) { continue }
                    guard let best = bestTopic[key] else { continue }
                    pool.append(article)
                    entityMap[key] = best.title
                    seenIDs.insert(key)
                }
            }
            let shuffled = pool.shuffled()

            await MainActor.run {
                articles = shuffled
                articleEntities = entityMap
            }
        } catch {
            // Silent fail — card will show nothing, but app still works
        }
    }

    private func runEntryAnimation() {
        // Halo blooms in first
        withAnimation(.easeOut(duration: 1.2).delay(0.2)) {
            haloVisible = true
        }
        // Letters spring in
        withAnimation(.spring(response: 1.3, dampingFraction: 0.8).delay(0.4)) {
            logoProgress = 1.0
        }
        // Rotating phrase
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.15) {
            withAnimation(.easeOut(duration: 0.7)) { taglineVisible = true }
        }
        // Buttons
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            withAnimation(.spring(response: 0.85, dampingFraction: 0.82)) {
                buttonsVisible = true
            }
        }
    }

    // MARK: Subviews

    private var currentArticleColor: Color {
        guard !articles.isEmpty else { return .clear }
        let key = articles[cardIndex].id.stringValue
        return articleColors[key] ?? .clear
    }

    private static let entityPalette: [Color] = [
        Color(hex: "#FF453A"),  // red
        Color(hex: "#FF9F0A"),  // orange
        Color(hex: "#FFD60A"),  // yellow
        Color(hex: "#30D158"),  // green
        Color(hex: "#5AC8FA"),  // teal
        Color(hex: "#0A84FF"),  // blue
        Color(hex: "#BF5AF2"),  // purple
        Color(hex: "#FF375F")   // pink
    ]

    /// Bold **keywords** from current article's title, plus category as fallback. Up to 4 items.
    private var currentArticleEntities: [String] {
        guard !articles.isEmpty else { return [] }
        let article = articles[cardIndex]

        let pattern = /\*\*(.+?)\*\*/
        var keywords: [String] = []
        for match in article.title.matches(of: pattern) {
            let word = String(match.1).trimmingCharacters(in: .whitespaces)
            if word.count >= 2, word.count <= 22 {
                keywords.append(word)
            }
        }
        if let cat = article.category?.trimmingCharacters(in: .whitespaces),
           !cat.isEmpty,
           !keywords.contains(where: { $0.lowercased() == cat.lowercased() }) {
            keywords.append(cat.capitalized)
        }
        return Array(keywords.prefix(4))
    }

    /// The entity this article belongs to — taken from the explore topic's display title
    /// (i.e. the closest match from the entity embedding map on the server).
    private var primaryEntity: String {
        guard !articles.isEmpty else { return "" }
        let key = articles[cardIndex].id.stringValue
        return articleEntities[key] ?? ""
    }

    /// Entity color derived from the card's extracted dominant color, made vivid
    /// so it pops on the dark background. Falls back to a palette color if the
    /// image hasn't finished loading yet.
    private var primaryEntityColor: Color {
        guard !articles.isEmpty else {
            return Self.entityPalette[cardIndex % Self.entityPalette.count]
        }
        let key = articles[cardIndex].id.stringValue
        if let c = articleColors[key] {
            return c.vivid()
        }
        return Self.entityPalette[cardIndex % Self.entityPalette.count]
    }

    private var ambientColorWash: some View {
        // Soft radial wash centered on the card area, gently tinted by current color
        RadialGradient(
            colors: [
                currentArticleColor.opacity(0.26),
                currentArticleColor.opacity(0.10),
                currentArticleColor.opacity(0.03),
                .clear
            ],
            center: UnitPoint(x: 0.5, y: 0.40),
            startRadius: 60,
            endRadius: 500
        )
        .blur(radius: 40)
    }

    private var topHeader: some View {
        HStack {
            // Small logo, left-aligned
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                ForEach(Array(logoLetters.enumerated()), id: \.offset) { i, letter in
                    LetterReveal(
                        letter: letter,
                        progress: logoProgress,
                        delay: Double(i) * 0.09,
                        color: .white,
                        highlighted: false,
                        size: 30
                    )
                }
                LetterReveal(
                    letter: "+",
                    progress: logoProgress,
                    delay: Double(logoLetters.count) * 0.09,
                    color: Color.white.opacity(0.55),
                    highlighted: false,
                    size: 30
                )
            }

            Spacer()
        }
    }

    private var feedCardStack: some View {
        Group {
            if articles.isEmpty {
                // Loading / skeleton placeholder matching the card dimensions
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(white: 0.08))
                    .frame(height: 380)
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .strokeBorder(.white.opacity(0.06), lineWidth: 1)
                    )
            } else {
                articleCard(at: cardIndex, depth: 0)
            }
        }
    }

    @ViewBuilder
    private func articleCard(at index: Int, depth: Int) -> some View {
        let article = articles[index]
        let key = article.id.stringValue
        let color = articleColors[key] ?? Color(white: 0.15)
        let metrics = sampleMetrics(for: article)

        ExploreArticleCard(
            article: article,
            fallbackColor: color,
            cardWidth: UIScreen.main.bounds.width - 40,
            cardHeight: 380,
            showTags: false,
            onDominantColorChanged: { c in
                articleColors[key] = c
            }
        )
        .overlay(alignment: .trailing) {
            socialRail(metrics: metrics, color: color)
                .frame(width: 40)
                .padding(.trailing, 10)
                .padding(.bottom, 50)
        }
        .shadow(color: color.opacity(0.10), radius: 44)
        .id("front-\(cardIndex)")
        .transition(.opacity.combined(with: .scale(scale: 0.97)))
    }

    // MARK: - Social rail

    private struct CardMetrics {
        let initial: String
        let handle: String
        let likes: String
        let comments: String
        let shares: String
        let saves: String
    }

    private func sampleMetrics(for article: ExploreTopicArticle) -> CardMetrics {
        let seed = article.id.stringValue.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        let handles = ["@today", "@pulse", "@newsroom", "@trending", "@daily_feed", "@briefly"]
        let handle = handles[seed % handles.count]
        let initial = String(handle.dropFirst().prefix(1)).uppercased()

        let likes = formatCount(1800 + (seed * 37) % 24000)
        let comments = formatCount(28 + (seed * 11) % 1400)
        let shares = formatCount(90 + (seed * 19) % 3200)
        let saves = formatCount(60 + (seed * 23) % 2100)

        return CardMetrics(
            initial: initial,
            handle: handle,
            likes: likes,
            comments: comments,
            shares: shares,
            saves: saves
        )
    }

    private func formatCount(_ n: Int) -> String {
        if n >= 1000 {
            let k = Double(n) / 1000
            let s = String(format: "%.1fK", k)
            return s.replacingOccurrences(of: ".0K", with: "K")
        }
        return String(n)
    }

    @ViewBuilder
    private func socialRail(metrics: CardMetrics, color: Color) -> some View {
        VStack(spacing: 14) {
            // Creator avatar
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [color.opacity(0.9), color.opacity(0.55)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        )
                    )
                Text(metrics.initial)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: 34, height: 34)
            .overlay(Circle().strokeBorder(.white.opacity(0.3), lineWidth: 1))
            .shadow(color: color.opacity(0.45), radius: 8)

            railItem("heart.fill", count: metrics.likes)
            railItem("bubble.left.fill", count: metrics.comments)
            railItem("arrowshape.turn.up.right.fill", count: metrics.shares)
            railItem("bookmark.fill", count: metrics.saves)
        }
    }

    private func railItem(_ icon: String, count: String) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white.opacity(0.92))
                .shadow(color: .black.opacity(0.45), radius: 4)
            Text(count)
                .font(.system(size: 9, weight: .semibold, design: .rounded))
                .foregroundStyle(.white.opacity(0.8))
                .monospacedDigit()
                .shadow(color: .black.opacity(0.4), radius: 3)
        }
    }

    private var welcomeBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("TRENDING NOW")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundStyle(.white.opacity(0.42))
                .tracking(2.6)

            // Hero entity — massive, tinted by card color
            if !primaryEntity.isEmpty {
                Text(primaryEntity)
                    .font(.system(size: 52, weight: .black, design: .rounded))
                    .foregroundStyle(primaryEntityColor)
                    .tracking(-2.0)
                    .lineLimit(2)
                    .minimumScaleFactor(0.5)
                    .fixedSize(horizontal: false, vertical: true)
                    .id(cardIndex)
                    .transition(.opacity.combined(with: .offset(y: 6)))
            } else {
                Text(" ")
                    .font(.system(size: 52, weight: .black, design: .rounded))
            }
        }
        .opacity(taglineVisible ? 1 : 0)
        .offset(y: taglineVisible ? 0 : 12)
        .blur(radius: taglineVisible ? 0 : 8)
        .animation(.smooth(duration: 0.5), value: cardIndex)
        .animation(.smooth(duration: 0.4), value: primaryEntityColor)
    }

    private var buttonStack: some View {
        VStack(spacing: 14) {
            Button {
                HapticManager.medium()
                onContinue()
            } label: {
                HStack(spacing: 8) {
                    Text("Create Account")
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .tracking(-0.2)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 54)
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.tint(primaryEntityColor.opacity(0.28)).interactive(), in: Capsule())
            .animation(.smooth(duration: 0.5), value: primaryEntityColor)

            Button {
                HapticManager.light()
                onSignIn()
            } label: {
                HStack(spacing: 4) {
                    Text("Already have an account?")
                        .foregroundStyle(.white.opacity(0.5))
                    Text("Sign In")
                        .foregroundStyle(.white)
                        .fontWeight(.semibold)
                }
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .contentShape(Rectangle())
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
        }
        .opacity(buttonsVisible ? 1 : 0)
        .offset(y: buttonsVisible ? 0 : 36)
        .blur(radius: buttonsVisible ? 0 : 10)
    }
}

// MARK: - Letter Reveal

private struct LetterReveal: View {
    let letter: String
    let progress: Double   // master 0→1 from parent
    let delay: Double      // seconds of stagger within master animation
    let color: Color
    let highlighted: Bool
    var size: CGFloat = 56

    var body: some View {
        // Map master progress through per-letter delay window
        let window = 0.5   // fraction of master animation each letter takes
        let start = delay / (delay + window + 0.2)
        let local = max(0, min(1, (progress - start) / (1 - start)))
        let eased = easeOutBack(local)

        Text(letter)
            .font(.system(size: size, weight: .bold, design: .rounded))
            .foregroundStyle(color)
            .tracking(-2)
            .shadow(color: highlighted ? Color(hex: "#C8A9FF").opacity(0.6) : .clear, radius: 16)
            .opacity(local)
            .blur(radius: (1 - local) * (size * 0.25))
            .scaleEffect(0.72 + eased * 0.28)
            .offset(y: (1 - eased) * (size * 0.5))
    }

    private func easeOutBack(_ t: Double) -> Double {
        let c1 = 1.70158
        let c3 = c1 + 1
        return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2)
    }
}

// MARK: - Floating Topics Layer (content verticals as glass chips)

private struct FloatingTopicsLayer: View {
    let time: Double
    let size: CGSize
    let visible: Bool

    private struct Topic {
        let emoji: String
        let text: String
    }

    private struct Chip {
        let topics: [Topic]          // cycles through these
        let x: Double                // 0-1 base position
        let y: Double
        let depth: Double            // 0.4-1.0 — affects scale + opacity
        let speed: Double            // orbit period
        let phase: Double            // orbit starting phase
        let radius: Double           // drift radius in points
        let enterDelay: Double
        let cycleInterval: Double    // seconds per label
        let cycleOffset: Double      // desync timing
        let glow: Color              // subtle colored glow
    }

    // Positioned avoiding center logo zone (x 0.28-0.72, y 0.34-0.56)
    // and bottom buttons area (y > 0.74)
    private let chips: [Chip] = [
        // Sports (American)
        Chip(
            topics: [.init(emoji: "🏈", text: "NFL"), .init(emoji: "🏀", text: "NBA"), .init(emoji: "⚾", text: "MLB"), .init(emoji: "🏒", text: "NHL")],
            x: 0.14, y: 0.10, depth: 0.82, speed: 0.055, phase: 0.00, radius: 16, enterDelay: 0.00,
            cycleInterval: 3.3, cycleOffset: 0.0, glow: Color(hex: "#FF9500")
        ),
        // Music
        Chip(
            topics: [.init(emoji: "🎤", text: "K-Pop"), .init(emoji: "🎧", text: "Hip-Hop"), .init(emoji: "🎸", text: "Indie"), .init(emoji: "🎹", text: "Pop")],
            x: 0.80, y: 0.09, depth: 0.95, speed: 0.042, phase: 0.25, radius: 18, enterDelay: 0.08,
            cycleInterval: 3.8, cycleOffset: 1.4, glow: Color(hex: "#FF4D9C")
        ),
        // Tech
        Chip(
            topics: [.init(emoji: "💻", text: "AI"), .init(emoji: "🤖", text: "Robotics"), .init(emoji: "🧠", text: "LLMs"), .init(emoji: "⚡", text: "Startups")],
            x: 0.52, y: 0.18, depth: 0.64, speed: 0.058, phase: 0.78, radius: 13, enterDelay: 0.14,
            cycleInterval: 4.1, cycleOffset: 2.3, glow: Color(hex: "#4DC5FF")
        ),
        // Food
        Chip(
            topics: [.init(emoji: "🍳", text: "Cooking"), .init(emoji: "🍕", text: "Recipes"), .init(emoji: "🥐", text: "Baking"), .init(emoji: "🔥", text: "BBQ")],
            x: 0.14, y: 0.27, depth: 0.58, speed: 0.062, phase: 0.66, radius: 11, enterDelay: 0.22,
            cycleInterval: 3.2, cycleOffset: 0.8, glow: Color(hex: "#FF9456")
        ),
        // Finance
        Chip(
            topics: [.init(emoji: "₿", text: "Crypto"), .init(emoji: "📈", text: "Stocks"), .init(emoji: "💰", text: "Markets"), .init(emoji: "🪙", text: "NFTs")],
            x: 0.86, y: 0.28, depth: 0.68, speed: 0.048, phase: 0.45, radius: 13, enterDelay: 0.16,
            cycleInterval: 3.6, cycleOffset: 1.8, glow: Color(hex: "#FFCC00")
        ),
        // Fashion
        Chip(
            topics: [.init(emoji: "👗", text: "Fashion"), .init(emoji: "👟", text: "Sneakers"), .init(emoji: "💅", text: "Beauty"), .init(emoji: "✨", text: "Runway")],
            x: 0.08, y: 0.57, depth: 0.88, speed: 0.054, phase: 0.18, radius: 15, enterDelay: 0.30,
            cycleInterval: 3.5, cycleOffset: 0.4, glow: Color(hex: "#FF2D55")
        ),
        // Space
        Chip(
            topics: [.init(emoji: "🚀", text: "Space"), .init(emoji: "🪐", text: "Planets"), .init(emoji: "🛸", text: "UFOs"), .init(emoji: "🌌", text: "Cosmos")],
            x: 0.90, y: 0.55, depth: 0.52, speed: 0.068, phase: 0.88, radius: 12, enterDelay: 0.38,
            cycleInterval: 3.9, cycleOffset: 2.0, glow: Color(hex: "#AF52DE")
        ),
        // Gaming
        Chip(
            topics: [.init(emoji: "🎮", text: "Gaming"), .init(emoji: "🕹️", text: "Esports"), .init(emoji: "📺", text: "Streaming"), .init(emoji: "👾", text: "Indie")],
            x: 0.16, y: 0.68, depth: 0.74, speed: 0.050, phase: 0.40, radius: 14, enterDelay: 0.45,
            cycleInterval: 3.1, cycleOffset: 1.5, glow: Color(hex: "#34C759")
        ),
        // Entertainment
        Chip(
            topics: [.init(emoji: "🎬", text: "Movies"), .init(emoji: "📺", text: "TV"), .init(emoji: "🍿", text: "Netflix"), .init(emoji: "🎭", text: "Drama")],
            x: 0.82, y: 0.68, depth: 0.86, speed: 0.060, phase: 0.62, radius: 16, enterDelay: 0.52,
            cycleInterval: 3.7, cycleOffset: 2.8, glow: Color(hex: "#FF3B30")
        ),
        // Sports (World)
        Chip(
            topics: [.init(emoji: "⚽", text: "Soccer"), .init(emoji: "🥇", text: "Olympics"), .init(emoji: "🏎️", text: "F1"), .init(emoji: "🎾", text: "Tennis")],
            x: 0.48, y: 0.64, depth: 0.48, speed: 0.055, phase: 0.10, radius: 11, enterDelay: 0.60,
            cycleInterval: 3.3, cycleOffset: 0.2, glow: Color(hex: "#00C7BE")
        )
    ]

    var body: some View {
        ZStack {
            ForEach(chips.indices, id: \.self) { i in
                chipView(chips[i])
            }
        }
    }

    @ViewBuilder
    private func chipView(_ chip: Chip) -> some View {
        // Drift motion
        let angle = (time * chip.speed + chip.phase) * .pi * 2
        let dx = cos(angle) * chip.radius
        let dy = sin(angle * 1.25) * (chip.radius * 0.55)
        let rot = sin(angle * 0.8) * 3

        let baseOpacity = 0.42 + chip.depth * 0.5
        let scale = 0.72 + chip.depth * 0.35

        // Cycle timing — continuous progress through the current label window
        let totalTime = time + chip.cycleOffset
        let cycleTime = totalTime.truncatingRemainder(dividingBy: chip.cycleInterval)
        let currentIndex = Int(totalTime / chip.cycleInterval) % chip.topics.count
        let nextIndex = (currentIndex + 1) % chip.topics.count

        // Fade happens in the last 0.45s of the cycle window
        let fadeDur: Double = 0.45
        let fadeStart = chip.cycleInterval - fadeDur
        let fadeProgress: Double = cycleTime > fadeStart
            ? (cycleTime - fadeStart) / fadeDur
            : 0

        // Subtle pulse at swap moment
        let swapPulse = 1.0 + (fadeProgress > 0 ? sin(fadeProgress * .pi) * 0.06 : 0)

        let current = chip.topics[currentIndex]
        let next = chip.topics[nextIndex]

        ZStack {
            // Outgoing label (current) — slides up and fades out
            labelPill(emoji: current.emoji, text: current.text)
                .opacity(1 - fadeProgress)
                .offset(y: -fadeProgress * 14)
                .blur(radius: fadeProgress * 4)

            // Incoming label (next) — rises from below, fades in
            labelPill(emoji: next.emoji, text: next.text)
                .opacity(fadeProgress)
                .offset(y: (1 - fadeProgress) * 14)
                .blur(radius: (1 - fadeProgress) * 4)
        }
        .shadow(color: chip.glow.opacity(0.35 * chip.depth), radius: 14, y: 2)
        .shadow(color: .black.opacity(0.35 * chip.depth), radius: 10, y: 4)
        .scaleEffect((visible ? scale : scale * 0.5) * swapPulse)
        .rotationEffect(.degrees(rot))
        .opacity(visible ? baseOpacity : 0)
        .blur(radius: visible ? 0 : 12)
        .animation(
            .spring(response: 0.9, dampingFraction: 0.72).delay(chip.enterDelay),
            value: visible
        )
        .position(
            x: size.width * chip.x + dx,
            y: size.height * chip.y + dy
        )
    }

    private func labelPill(emoji: String, text: String) -> some View {
        HStack(spacing: 6) {
            Text(emoji)
                .font(.system(size: 14))
            Text(text)
                .font(.system(size: 12.5, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(
            Capsule().strokeBorder(.white.opacity(0.18), lineWidth: 0.8)
        )
    }
}

// MARK: - Sparkle Emitter (bursts from + sign)

private struct SparkleEmitter: View {
    let time: Double
    let size: CGSize
    let active: Bool

    // Emit a sparkle every 0.35s; each lives 1.6s rising & fading
    private let sparkleCount = 10
    private let lifetime: Double = 1.6
    private let cycle: Double = 3.5      // total cycle = sparkleCount * emitInterval
    private let emitInterval: Double = 0.35

    var body: some View {
        Canvas { ctx, canvasSize in
            guard active else { return }

            // Anchor position matches the "+" in "today+"
            let anchorX = canvasSize.width / 2 + 52
            let anchorY = canvasSize.height * 0.40 - 8

            for i in 0..<sparkleCount {
                let delay = Double(i) * emitInterval
                var localTime = (time - delay).truncatingRemainder(dividingBy: Double(sparkleCount) * emitInterval)
                if localTime < 0 { localTime += Double(sparkleCount) * emitInterval }
                guard localTime < lifetime else { continue }

                let progress = localTime / lifetime   // 0→1
                let angle = Double(i) * 0.83 + delay * 3
                let distance = progress * 60

                let x = anchorX + cos(angle) * distance + sin(progress * 6) * 4
                let y = anchorY - progress * 90 + sin(angle) * 12

                // Fade in then out, peak at 0.3
                let alphaCurve: Double
                if progress < 0.15 {
                    alphaCurve = progress / 0.15
                } else {
                    alphaCurve = 1.0 - (progress - 0.15) / 0.85
                }
                let alpha = alphaCurve * 0.9

                // Draw as a 4-pointed sparkle: small crossed lines
                let sparkleSize: CGFloat = 3 + CGFloat(1 - progress) * 3
                var path = Path()
                path.move(to: CGPoint(x: x - sparkleSize, y: y))
                path.addLine(to: CGPoint(x: x + sparkleSize, y: y))
                path.move(to: CGPoint(x: x, y: y - sparkleSize))
                path.addLine(to: CGPoint(x: x, y: y + sparkleSize))

                ctx.stroke(
                    path,
                    with: .color(.white.opacity(alpha)),
                    lineWidth: 1.2
                )
            }
        }
    }
}

// MARK: - Animated Mesh Background

private struct AnimatedMeshBackground: View {
    let time: Double

    var body: some View {
        let t = time * 0.22
        let s = { (v: Double) -> Float in Float(sin(v)) }
        let c = { (v: Double) -> Float in Float(cos(v)) }

        MeshGradient(
            width: 3,
            height: 3,
            points: [
                [0, 0],
                [0.5 + 0.14 * s(t * 1.0), 0],
                [1, 0],

                [0, 0.5 + 0.12 * c(t * 0.8)],
                [0.5 + 0.10 * s(t * 1.3), 0.5 + 0.10 * c(t * 0.9)],
                [1, 0.5 + 0.12 * s(t * 1.1)],

                [0, 1],
                [0.5 + 0.14 * c(t * 1.2), 1],
                [1, 1]
            ],
            colors: [
                Color(hex: "#05010E"), Color(hex: "#1A0B3A"), Color(hex: "#080316"),
                Color(hex: "#2B1170"), Color(hex: "#4A1D8F"), Color(hex: "#0F1A5C"),
                Color(hex: "#0A0118"), Color(hex: "#1B0D3A"), Color(hex: "#05010A")
            ]
        )
    }
}

// MARK: - Bokeh Orb Layer

private struct BokehLayer: View {
    let time: Double
    let size: CGSize

    private struct Orb {
        let x, y, radius, speed, phase: Double
        let diameter: CGFloat
        let color: Color
        let opacity: Double
    }

    private let orbs: [Orb] = [
        Orb(x: 0.22, y: 0.18, radius: 55, speed: 0.08, phase: 0.0, diameter: 300, color: Color(hex: "#7C4DFF"), opacity: 0.55),
        Orb(x: 0.82, y: 0.28, radius: 48, speed: 0.10, phase: 0.35, diameter: 240, color: Color(hex: "#FF4D9C"), opacity: 0.40),
        Orb(x: 0.30, y: 0.78, radius: 60, speed: 0.06, phase: 0.60, diameter: 340, color: Color(hex: "#4DC5FF"), opacity: 0.45),
        Orb(x: 0.85, y: 0.85, radius: 50, speed: 0.09, phase: 0.85, diameter: 280, color: Color(hex: "#FF9456"), opacity: 0.30),
        Orb(x: 0.55, y: 0.45, radius: 35, speed: 0.07, phase: 0.50, diameter: 220, color: Color(hex: "#B794FF"), opacity: 0.28)
    ]

    var body: some View {
        ZStack {
            ForEach(orbs.indices, id: \.self) { i in
                let o = orbs[i]
                let angle = (time * o.speed + o.phase) * .pi * 2
                let dx = cos(angle) * o.radius
                let dy = sin(angle * 1.3) * (o.radius * 0.85)
                let pulse = 1.0 + sin(time * 0.6 + o.phase * 6) * 0.08

                Circle()
                    .fill(o.color.opacity(o.opacity))
                    .frame(width: o.diameter * pulse, height: o.diameter * pulse)
                    .blur(radius: 70)
                    .position(
                        x: size.width * o.x + dx,
                        y: size.height * o.y + dy
                    )
            }
        }
    }
}

// MARK: - Particle Canvas (streaming starfield)

private struct ParticleCanvas: View {
    let time: Double

    private struct Seed {
        let x: Double          // 0-1 horizontal position
        let yOffset: Double    // 0-1 initial vertical offset
        let speed: Double      // vertical fraction per second
        let size: CGFloat
        let opacity: Double
        let twinkleFreq: Double
        let twinklePhase: Double
        let drift: Double      // horizontal sway amplitude
        let driftFreq: Double
    }

    private static let seeds: [Seed] = {
        var rng = SeededGenerator(seed: 1337)
        return (0..<70).map { _ in
            Seed(
                x: Double.random(in: 0...1, using: &rng),
                yOffset: Double.random(in: 0...1, using: &rng),
                speed: Double.random(in: 0.015...0.07, using: &rng),
                size: CGFloat.random(in: 1.0...2.8, using: &rng),
                opacity: Double.random(in: 0.25...0.85, using: &rng),
                twinkleFreq: Double.random(in: 1.5...3.5, using: &rng),
                twinklePhase: Double.random(in: 0...6.28, using: &rng),
                drift: Double.random(in: 4...14, using: &rng),
                driftFreq: Double.random(in: 0.3...0.9, using: &rng)
            )
        }
    }()

    var body: some View {
        Canvas { ctx, canvasSize in
            for p in Self.seeds {
                // Stream upward, wrap
                let rawY = (p.yOffset + time * p.speed).truncatingRemainder(dividingBy: 1.0)
                let yPos = (1.0 - rawY) * canvasSize.height

                // Horizontal drift
                let dx = sin(time * p.driftFreq + p.twinklePhase) * p.drift
                let xPos = p.x * canvasSize.width + dx

                // Twinkle
                let twinkle = 0.45 + (sin(time * p.twinkleFreq + p.twinklePhase) + 1) * 0.275

                let rect = CGRect(
                    x: xPos - p.size / 2,
                    y: yPos - p.size / 2,
                    width: p.size,
                    height: p.size
                )
                ctx.fill(
                    Path(ellipseIn: rect),
                    with: .color(.white.opacity(p.opacity * twinkle))
                )
            }
        }
    }
}

// Deterministic RNG so particle distribution is stable across runs
private struct SeededGenerator: RandomNumberGenerator {
    var state: UInt64
    init(seed: UInt64) { state = seed == 0 ? 1 : seed }
    mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return state
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
