import SwiftUI

/// Simple animated globe visualization with rotating meridian lines
struct GlobeView: View {
    @State private var rotation: Double = 0
    var size: CGFloat = 120

    var body: some View {
        ZStack {
            // Globe circle
            Circle()
                .stroke(Theme.Colors.accent.opacity(0.3), lineWidth: 1.5)
                .frame(width: size, height: size)

            // Equator line
            Ellipse()
                .stroke(Theme.Colors.accent.opacity(0.4), lineWidth: 1)
                .frame(width: size, height: size * 0.3)

            // Meridian lines (rotating)
            ForEach(0..<3, id: \.self) { index in
                Ellipse()
                    .stroke(Theme.Colors.accent.opacity(0.25), lineWidth: 0.8)
                    .frame(width: size * meridianWidth(index: index), height: size)
                    .rotation3DEffect(
                        .degrees(rotation + Double(index) * 60),
                        axis: (x: 0, y: 1, z: 0)
                    )
            }

            // Center dot
            Circle()
                .fill(Theme.Colors.accent.opacity(0.6))
                .frame(width: 6, height: 6)

            // Subtle fill
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Theme.Colors.accent.opacity(0.08),
                            Theme.Colors.accent.opacity(0.02),
                            .clear,
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: size / 2
                    )
                )
                .frame(width: size, height: size)
        }
        .onAppear {
            withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
                rotation = 360
            }
        }
    }

    private func meridianWidth(index: Int) -> CGFloat {
        switch index {
        case 0: return 0.6
        case 1: return 0.35
        case 2: return 0.85
        default: return 0.5
        }
    }
}

#Preview {
    GlobeView()
        .padding()
}
