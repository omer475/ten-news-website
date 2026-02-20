import SwiftUI

/// Shimmer animation modifier for loading skeleton placeholders
struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1.0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: max(0, phase - 0.3)),
                            .init(color: .white.opacity(0.15), location: phase),
                            .init(color: .clear, location: min(1, phase + 0.3)),
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width, height: geo.size.height)
                }
                .clipped()
            )
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 2.0
                }
            }
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}
