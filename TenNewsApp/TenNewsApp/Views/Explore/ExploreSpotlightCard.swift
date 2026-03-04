import SwiftUI

struct ExploreSpotlightCard: View {
    let article: Article
    var badgeLabel: String = "SPOTLIGHT"
    var badgeIcon: String = "star.fill"
    var badgeColor: Color = Color(hex: "#AF52DE")

    /// Strip markdown bold markers from text
    private func stripMarkdown(_ text: String) -> String {
        text.replacingOccurrences(of: "**", with: "")
    }

    var body: some View {
        GeometryReader { geo in
            let cardWidth = geo.size.width
            let cardHeight: CGFloat = 380

            ZStack(alignment: .topLeading) {
                // Background image
                if let imageUrl = article.displayImage {
                    AsyncCachedImage(url: imageUrl, contentMode: .fill)
                        .frame(width: cardWidth, height: cardHeight)
                        .clipped()
                } else {
                    Rectangle()
                        .fill(Color(white: 0.12).gradient)
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

                // Badge top-left
                HStack(spacing: 5) {
                    Image(systemName: badgeIcon)
                        .font(.system(size: 8))
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

                // Title + meta at bottom
                VStack(alignment: .leading, spacing: 6) {
                    Spacer()

                    // Category
                    if let cat = article.category {
                        Text(cat.uppercased())
                            .font(.system(size: 10, weight: .heavy))
                            .tracking(1.0)
                            .foregroundStyle(categoryColor(for: cat))
                    }

                    // Title
                    let title = article.plainTitle
                    Text(title)
                        .font(.system(size: title.count > 60 ? 18 : 21, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)

                    // Source + time
                    HStack(spacing: 6) {
                        if let source = article.source {
                            Text(source)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.white.opacity(0.65))
                                .lineLimit(1)
                        }
                        if let dateStr = article.publishedAt ?? article.createdAt {
                            Circle()
                                .fill(.white.opacity(0.3))
                                .frame(width: 3, height: 3)
                            TimeAgoText(dateStr)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.white.opacity(0.4))
                        }
                    }

                    // First bullet as teaser
                    if let bullet = article.displayBullets.first {
                        Text(stripMarkdown(bullet))
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.45))
                            .lineLimit(2)
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
    }

    private func categoryColor(for category: String) -> Color {
        let colors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
            "Climate": "#339966", "Economy": "#228866",
        ]
        return Color(hex: colors[category] ?? "#3366CC")
    }
}
