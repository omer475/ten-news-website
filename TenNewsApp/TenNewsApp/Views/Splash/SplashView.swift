import SwiftUI

/// Splash/home screen matching website design
struct SplashView: View {
    @State private var eventsViewModel = WorldEventsViewModel()
    @State private var showFeed = false
    @State private var dragOffset: CGFloat = 0

    var onSignUp: (() -> Void)?
    var onEnterFeed: (() -> Void)?

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Background gradient based on time of day
                TimeOfDay.current.backgroundGradient
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Top bar: logo + sign up
                    topBar
                        .padding(.top, 8)

                    Spacer()

                    // Time-based greeting
                    TimeGreetingView()
                        .padding(.horizontal, Theme.Spacing.lg)

                    // Subtitle
                    Text("Here are the stories that matter right now.")
                        .font(Theme.Fonts.body())
                        .foregroundStyle(Theme.Colors.secondaryText)
                        .padding(.top, 8)
                        .padding(.horizontal, Theme.Spacing.lg)

                    Spacer()

                    // World Events section
                    VStack(alignment: .leading, spacing: 12) {
                        Text("WORLD EVENTS")
                            .font(Theme.Fonts.sectionLabel())
                            .foregroundStyle(Theme.Colors.secondaryText)
                            .tracking(1.5)
                            .padding(.horizontal, Theme.Spacing.md)

                        if eventsViewModel.isLoading {
                            eventLoadingPlaceholder
                        } else {
                            eventCardsScroll
                        }
                    }

                    Spacer()

                    // Swipe hint
                    SwipeHintView()
                        .padding(.bottom, Theme.Spacing.xl)
                }
            }
            .gesture(
                DragGesture()
                    .onChanged { value in
                        if value.translation.height < 0 {
                            dragOffset = value.translation.height
                        }
                    }
                    .onEnded { value in
                        if value.translation.height < -100 {
                            HapticManager.medium()
                            onEnterFeed?()
                        }
                        withAnimation(AppAnimations.swipeTransition) {
                            dragOffset = 0
                        }
                    }
            )
            .offset(y: dragOffset * 0.3)
        }
        .task {
            await eventsViewModel.loadEvents()
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            // Logo
            Text("Today+")
                .font(.system(size: 22, weight: .bold, design: .serif))
                .foregroundStyle(Theme.Colors.primaryText)

            Spacer()

            // Sign up button
            Button {
                onSignUp?()
            } label: {
                Text("Sign up")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Colors.accent)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .glassEffect(.regular, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Theme.Spacing.md)
    }

    // MARK: - Event Cards Scroll

    private var eventCardsScroll: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(eventsViewModel.events) { event in
                    splashEventCard(event)
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
        }
    }

    private func splashEventCard(_ event: WorldEvent) -> some View {
        let blurColor: Color = {
            if let hex = event.blurColor { return Color(hex: hex) }
            return Color(hex: "#1a1a2e")
        }()

        return ZStack(alignment: .bottomLeading) {
            if let imageUrl = event.displayImage {
                AsyncCachedImage(url: imageUrl)
                    .frame(width: 180, height: 120)
                    .clipped()
            } else {
                Rectangle()
                    .fill(blurColor.gradient)
                    .frame(width: 180, height: 120)
            }

            LinearGradient(
                colors: [.clear, blurColor.opacity(0.8)],
                startPoint: .top,
                endPoint: .bottom
            )

            Text(event.name)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .glassEffect(.regular, in: UnevenRoundedRectangle(
                    bottomLeadingRadius: Theme.CornerRadius.medium,
                    bottomTrailingRadius: Theme.CornerRadius.medium
                ))
        }
        .frame(width: 180, height: 120)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))
    }

    // MARK: - Loading Placeholder

    private var eventLoadingPlaceholder: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                        .fill(Color(hex: "#e5e5ea").opacity(0.3))
                        .frame(width: 180, height: 120)
                        .overlay { LoadingDotsView() }
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
        }
    }
}

#Preview {
    SplashView()
}
