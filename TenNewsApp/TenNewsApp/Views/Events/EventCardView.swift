import SwiftUI

/// Event card with image, name overlay, and glass bottom bar.
struct EventCardView: View {
    let event: WorldEvent

    var body: some View {
        NavigationLink(value: event) {
            ZStack(alignment: .bottomLeading) {
                if let imageUrl = event.displayImage {
                    AsyncCachedImage(url: imageUrl)
                        .frame(width: 220, height: 150)
                        .clipped()
                } else {
                    Rectangle()
                        .fill(Color(hex: event.blurColor ?? "#1a1a2e").gradient)
                        .frame(width: 220, height: 150)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Spacer()

                    if let updates = event.newUpdates, updates > 0 {
                        Text("\(updates) new")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .glassEffect(.regular.tint(.red).interactive(), in: Capsule())
                    }

                    Text(event.name)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .glassEffect(.regular.interactive(), in: UnevenRoundedRectangle(
                    bottomLeadingRadius: Theme.CornerRadius.medium,
                    bottomTrailingRadius: Theme.CornerRadius.medium
                ))
            }
            .frame(width: 220, height: 150)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        HStack(spacing: 12) {
            EventCardView(event: PreviewData.sampleEvent)
            EventCardView(event: PreviewData.sampleEvents[1])
        }
        .padding()
    }
}
