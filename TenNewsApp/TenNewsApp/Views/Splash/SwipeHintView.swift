import SwiftUI

/// Animated swipe-up hint with chevron icon and text
struct SwipeHintView: View {
    @State private var offset: CGFloat = 0
    @State private var opacity: Double = 0.6

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "chevron.up")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Colors.secondaryText)

            Text("Swipe up to read")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Colors.secondaryText)
        }
        .offset(y: offset)
        .opacity(opacity)
        .onAppear {
            withAnimation(
                .easeInOut(duration: 1.2)
                .repeatForever(autoreverses: true)
            ) {
                offset = -8
                opacity = 1.0
            }
        }
    }
}

#Preview {
    SwipeHintView()
        .padding()
}
