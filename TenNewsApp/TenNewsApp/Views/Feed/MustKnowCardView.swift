import SwiftUI

/// 280×180 hero card for "Must Know" articles — image with glass bottom overlay.
struct MustKnowCardView: View {
    let article: Article
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack(alignment: .bottomLeading) {
                // Hero image
                if let imageUrl = article.displayImage {
                    AsyncCachedImage(url: imageUrl, contentMode: .fill)
                        .frame(width: 280, height: 180)
                        .clipped()
                } else {
                    Rectangle()
                        .fill(categoryGradient)
                        .frame(width: 280, height: 180)
                        .overlay {
                            Text(article.emoji ?? "\u{1F4F0}")
                                .font(.system(size: 36))
                        }
                }

                // Category badge top-left
                if let category = article.category {
                    VStack {
                        HStack {
                            Text(category.uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .tracking(0.5)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .glassEffect(.regular.tint(.black.opacity(0.3)).interactive(), in: Capsule())
                            Spacer()
                        }
                        Spacer()
                    }
                    .padding(10)
                }

                // Glass bottom bar with title + source/time
                VStack(alignment: .leading, spacing: 4) {
                    Spacer()

                    article.displayTitle.coloredTitle(
                        size: 15,
                        weight: .bold,
                        baseColor: .white,
                        highlightColor: Color(hex: "A0C4FF").vivid()
                    )
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        if let source = article.source {
                            Text(source)
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        TimeAgoText(article.publishedAt)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .glassEffect(.regular.interactive(), in: UnevenRoundedRectangle(
                    bottomLeadingRadius: Theme.CornerRadius.medium,
                    bottomTrailingRadius: Theme.CornerRadius.medium
                ))
            }
            .frame(width: 280, height: 180)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))
        }
        .buttonStyle(.plain)
    }

    private var categoryGradient: LinearGradient {
        let gradients: [String: [Color]] = [
            "Tech": [Color(hex: "#667eea"), Color(hex: "#764ba2")],
            "Business": [Color(hex: "#11998e"), Color(hex: "#38ef7d")],
            "Finance": [Color(hex: "#f093fb"), Color(hex: "#f5576c")],
            "Politics": [Color(hex: "#4facfe"), Color(hex: "#00f2fe")],
            "World": [Color(hex: "#43e97b"), Color(hex: "#38f9d7")],
            "Science": [Color(hex: "#fa709a"), Color(hex: "#fee140")],
        ]
        let colors = gradients[article.category ?? ""] ?? [Color(hex: "#667eea"), Color(hex: "#764ba2")]
        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}
