import SwiftUI

/// Event card with image, name overlay, blur color background, update counter badge
struct EventCardView: View {
    let event: WorldEvent
    @State private var showDetail = false

    private var blurColor: Color {
        if let hex = event.blurColor {
            return Color(hex: hex)
        }
        return Color(hex: "#1a1a2e")
    }

    var body: some View {
        Button {
            showDetail = true
            HapticManager.light()
        } label: {
            ZStack(alignment: .bottomLeading) {
                // Background image or color
                if let imageUrl = event.displayImage {
                    AsyncCachedImage(url: imageUrl)
                        .frame(width: 200, height: 130)
                        .clipped()
                } else {
                    Rectangle()
                        .fill(blurColor.gradient)
                        .frame(width: 200, height: 130)
                }

                // Gradient overlay
                LinearGradient(
                    colors: [.clear, blurColor.opacity(0.8), blurColor],
                    startPoint: .top,
                    endPoint: .bottom
                )

                // Name overlay with glass effect
                VStack(alignment: .leading, spacing: 4) {
                    Spacer()

                    // Update counter badge
                    if let updates = event.newUpdates, updates > 0 {
                        Text("\(updates) new")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.Colors.accent, in: Capsule())
                    }

                    Text(event.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .glassEffect(.regular, in: UnevenRoundedRectangle(
                    bottomLeadingRadius: Theme.CornerRadius.medium,
                    bottomTrailingRadius: Theme.CornerRadius.medium
                ))
            }
            .frame(width: 200, height: 130)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))
        }
        .buttonStyle(.plain)
        .fullScreenCover(isPresented: $showDetail) {
            EventDetailView(event: event)
        }
    }
}

#Preview {
    HStack(spacing: 12) {
        EventCardView(event: PreviewData.sampleEvent)
        EventCardView(event: PreviewData.sampleEvents[1])
    }
    .padding()
}
