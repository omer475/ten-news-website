import SwiftUI

/// Animated loading indicator with 3 pulsing dots.
/// Uses TimelineView for leak-free animation (no Timer to invalidate).
struct LoadingDotsView: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.6)) { timeline in
            let index = Int(timeline.date.timeIntervalSinceReferenceDate / 0.6) % 3
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { dot in
                    Circle()
                        .fill(Theme.Colors.accent)
                        .frame(width: 8, height: 8)
                        .scaleEffect(index == dot ? 1.3 : 0.7)
                        .opacity(index == dot ? 1.0 : 0.4)
                        .animation(.easeInOut(duration: 0.4), value: index)
                }
            }
        }
    }
}

#Preview("Loading Dots") {
    LoadingDotsView()
        .padding()
}
