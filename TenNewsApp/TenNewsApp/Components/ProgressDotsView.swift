import SwiftUI

/// Vertical dots on right edge showing progress through articles
struct ProgressDotsView: View {
    let total: Int
    let current: Int
    var dotSize: CGFloat = 6
    var spacing: CGFloat = 8

    var body: some View {
        VStack(spacing: spacing) {
            ForEach(0..<total, id: \.self) { index in
                Circle()
                    .fill(index == current ? Theme.Colors.accent : Theme.Colors.dotInactive)
                    .frame(width: dotSize, height: dotSize)
                    .scaleEffect(index == current ? 1.2 : 1.0)
                    .animation(AppAnimations.quickSpring, value: current)
            }
        }
    }
}

#Preview("Progress Dots") {
    ProgressDotsView(total: 5, current: 2)
        .padding()
}
