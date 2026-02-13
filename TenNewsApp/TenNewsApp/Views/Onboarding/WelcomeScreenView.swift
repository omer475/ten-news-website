import SwiftUI

/// Welcome screen with app name, tagline, and "Get Started" button
struct WelcomeScreenView: View {
    var onGetStarted: (() -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Globe visualization
            GlobeView(size: 140)
                .padding(.bottom, Theme.Spacing.xl)

            // App name
            VStack(spacing: 12) {
                Text("Today+")
                    .font(.system(size: 48, weight: .bold, design: .serif))
                    .foregroundStyle(Theme.Colors.primaryText)

                Text("Your intelligent news companion")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Theme.Colors.secondaryText)

                Text("Personalized world news, curated by AI.\nStay informed about what matters to you.")
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.tertiaryText)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.top, 4)
            }

            Spacer()

            // Get Started button
            GlassCTAButton(title: "Get Started") {
                onGetStarted?()
            }
            .padding(.horizontal, Theme.Spacing.xl)
            .padding(.bottom, Theme.Spacing.xl)
        }
        .padding(.horizontal, Theme.Spacing.lg)
    }
}

#Preview {
    WelcomeScreenView()
}
