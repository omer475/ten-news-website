import SwiftUI

struct ExploreQuickReadCard: View {
    let article: Article

    var body: some View {
        ZStack(alignment: .bottom) {
            // Background — use image if available, otherwise gradient with emoji
            if let imageUrl = article.displayImage {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(width: 160, height: 200)
                    .clipped()
            } else {
                let cat = article.category ?? ""
                Rectangle()
                    .fill(categoryColor(for: cat).opacity(0.25).gradient)
                    .frame(width: 160, height: 200)
                    .overlay {
                        Text(article.emoji ?? "")
                            .font(.system(size: 36))
                            .opacity(0.5)
                    }
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
                                .init(color: .black.opacity(0.4), location: 0.2),
                                .init(color: .black, location: 0.6),
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: 120)
            }

            // Quick badge top-right
            VStack {
                HStack {
                    Spacer()
                    HStack(spacing: 3) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 8))
                        Text("QUICK")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.5)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(hex: "#34C759").opacity(0.75))
                    .clipShape(Capsule())
                }
                .padding(10)
                Spacer()
            }

            // Bottom info
            VStack(alignment: .leading, spacing: 5) {
                if let cat = article.category {
                    Text(cat.uppercased())
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(categoryColor(for: cat))
                }

                Text(article.plainTitle)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                if let source = article.source {
                    Text(source)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.white.opacity(0.45))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
        .frame(width: 160, height: 200)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color(hex: "#34C759").opacity(0.15), lineWidth: 0.5)
        )
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
