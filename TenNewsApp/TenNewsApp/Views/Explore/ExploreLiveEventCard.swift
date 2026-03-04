import SwiftUI

struct ExploreLiveEventCard: View {
    let event: WorldEvent
    var badgeLabel: String = "LIVE"
    var badgeIcon: String = "dot.radiowaves.left.and.right"
    var badgeColor: Color = Color(hex: "#ff3b30")

    @State private var pulseOpacity: Double = 1.0

    var body: some View {
        GeometryReader { geo in
            let cardWidth = geo.size.width
            let cardHeight: CGFloat = 380

            ZStack(alignment: .topLeading) {
                // Background image
                if let imageUrl = event.displayImage {
                    AsyncCachedImage(url: imageUrl, contentMode: .fill)
                        .frame(width: cardWidth, height: cardHeight)
                        .clipped()
                } else {
                    Rectangle()
                        .fill(Color(hex: event.blurColor ?? "#1a1a2e").gradient)
                        .frame(width: cardWidth, height: cardHeight)
                }

                // Glass gradient overlay
                VStack(spacing: 0) {
                    Spacer()
                    Rectangle()
                        .fill(.ultraThinMaterial)
                        .mask(
                            LinearGradient(
                                stops: [
                                    .init(color: .clear, location: 0.0),
                                    .init(color: .black.opacity(0.3), location: 0.12),
                                    .init(color: .black.opacity(0.7), location: 0.3),
                                    .init(color: .black, location: 0.55),
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(height: 260)
                }
                .frame(width: cardWidth, height: cardHeight)

                // Dark bottom reinforcement
                VStack {
                    Spacer()
                    LinearGradient(
                        colors: [.clear, .black.opacity(0.25)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 80)
                }
                .frame(width: cardWidth, height: cardHeight)
                .allowsHitTesting(false)

                // Red edge glow at top
                VStack {
                    LinearGradient(
                        colors: [badgeColor.opacity(0.3), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 4)
                    Spacer()
                }
                .frame(width: cardWidth, height: cardHeight)
                .allowsHitTesting(false)

                // Badge top-left
                HStack(spacing: 5) {
                    if badgeLabel == "LIVE" {
                        Circle()
                            .fill(badgeColor)
                            .frame(width: 6, height: 6)
                            .opacity(pulseOpacity)
                    } else {
                        Image(systemName: badgeIcon)
                            .font(.system(size: 8))
                    }
                    Text(badgeLabel)
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.8)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(badgeColor.opacity(0.75))
                .background(.ultraThinMaterial.opacity(0.4))
                .clipShape(Capsule())
                .padding(.leading, 16)
                .padding(.top, 14)

                // Bottom content
                VStack(alignment: .leading, spacing: 6) {
                    Spacer()

                    Text(event.name)
                        .font(.system(size: 21, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)

                    if let bg = event.background, !bg.isEmpty {
                        Text(String(bg.prefix(120)))
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.45))
                            .lineLimit(2)
                    }

                    // Meta row
                    HStack(spacing: 8) {
                        if let updates = event.newUpdates, updates > 0 {
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .font(.system(size: 9, weight: .bold))
                                Text("\(updates) updates")
                                    .font(.system(size: 11, weight: .semibold))
                            }
                            .foregroundStyle(.white.opacity(0.6))
                        }

                        HStack(spacing: 4) {
                            Image(systemName: "flame.fill")
                                .font(.system(size: 9))
                            Text("\(Int(event.importanceLevel))/10")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundStyle(.white.opacity(0.5))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .frame(width: cardWidth, height: cardHeight, alignment: .bottomLeading)
            }
            .frame(width: cardWidth, height: cardHeight)
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .shadow(color: .black.opacity(0.3), radius: 20, y: 8)
        }
        .frame(height: 380)
        .onAppear {
            if badgeLabel == "LIVE" {
                withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
                    pulseOpacity = 0.3
                }
            }
        }
    }
}
