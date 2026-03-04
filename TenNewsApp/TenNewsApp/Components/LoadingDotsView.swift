import SwiftUI

/// Animated loading indicator with 3 pulsing dots
struct LoadingDotsView: View {
    @State private var activeIndex = 0

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Theme.Colors.accent)
                    .frame(width: 8, height: 8)
                    .scaleEffect(activeIndex == index ? 1.3 : 0.7)
                    .opacity(activeIndex == index ? 1.0 : 0.4)
                    .animation(
                        .easeInOut(duration: 0.4).delay(Double(index) * 0.15),
                        value: activeIndex
                    )
            }
        }
        .onAppear {
            Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { _ in
                activeIndex = (activeIndex + 1) % 3
            }
        }
    }
}

#Preview("Loading Dots") {
    LoadingDotsView()
        .padding()
}
