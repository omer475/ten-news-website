import SwiftUI

/// "You're all caught up" view displayed when the user has seen all articles.
/// Features a checkmark animation and an Explore button to browse world events.
struct CaughtUpView: View {
    @State private var showCheckmark = false
    @State private var pulseCheckmark = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            // Animated checkmark
            ZStack {
                // Pulse ring
                Circle()
                    .stroke(Theme.Colors.accent.opacity(0.2), lineWidth: 2)
                    .frame(width: 100, height: 100)
                    .scaleEffect(pulseCheckmark ? 1.3 : 1.0)
                    .opacity(pulseCheckmark ? 0 : 0.5)

                // Checkmark icon
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(Theme.Colors.accent)
                    .scaleEffect(showCheckmark ? 1.0 : 0.3)
                    .opacity(showCheckmark ? 1.0 : 0)
            }

            Text("You're all caught up!")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.Colors.primaryText)
                .opacity(showCheckmark ? 1 : 0)
                .offset(y: showCheckmark ? 0 : 10)

            Text("Come back later for more news")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .opacity(showCheckmark ? 1 : 0)
                .offset(y: showCheckmark ? 0 : 10)

            // Explore button
            GlassCTAButton(title: "Explore World Events") {
                // Navigation handled by parent
            }
            .frame(width: 220)
            .opacity(showCheckmark ? 1 : 0)
            .offset(y: showCheckmark ? 0 : 20)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6).delay(0.1)) {
                showCheckmark = true
            }
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true).delay(0.6)) {
                pulseCheckmark = true
            }
            HapticManager.success()
        }
    }
}

#Preview {
    CaughtUpView()
}
