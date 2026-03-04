import SwiftUI

/// Vertical dots on right edge showing progress through articles — glass-backed capsule
struct ProgressDotsView: View {
    let total: Int
    let current: Int
    var dotSize: CGFloat = 7
    var spacing: CGFloat = 8

    var body: some View {
        VStack(spacing: spacing) {
            ForEach(0..<total, id: \.self) { index in
                Capsule()
                    .fill(index == current ? .white : .white.opacity(0.35))
                    .frame(
                        width: dotSize,
                        height: index == current ? dotSize * 2.5 : dotSize
                    )
                    .animation(AppAnimations.quickSpring, value: current)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 10)
        .glassEffect(.regular, in: Capsule())
    }
}

#Preview("Progress Dots") {
    ProgressDotsView(total: 5, current: 2)
        .padding()
}
