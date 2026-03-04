import SwiftUI

/// Numbered row for the Top Stories list — number, title, source/category/time, thumbnail.
struct TopStoryRowView: View {
    let number: Int
    let article: Article
    let accentColor: Color
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Large number
                Text("\(number)")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(accentColor.opacity(0.35))
                    .frame(width: 32, alignment: .trailing)

                // Title + meta
                VStack(alignment: .leading, spacing: 4) {
                    article.displayTitle.coloredTitle(
                        size: 14,
                        weight: .semibold,
                        baseColor: .white,
                        highlightColor: accentColor.vivid()
                    )
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                    HStack(spacing: 5) {
                        if let source = article.source {
                            Text(source)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        if let category = article.category {
                            Text("·")
                                .foregroundStyle(.tertiary)
                            Text(category)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.secondary)
                        }
                        TimeAgoText(article.publishedAt)
                    }
                }

                Spacer(minLength: 4)

                // Thumbnail
                if let imageUrl = article.displayImage {
                    AsyncCachedImage(url: imageUrl, contentMode: .fill)
                        .frame(width: 60, height: 60)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(accentColor.opacity(0.15))
                        .frame(width: 60, height: 60)
                        .overlay {
                            Text(article.emoji ?? "\u{1F4F0}")
                                .font(.system(size: 20))
                        }
                }
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }
}
