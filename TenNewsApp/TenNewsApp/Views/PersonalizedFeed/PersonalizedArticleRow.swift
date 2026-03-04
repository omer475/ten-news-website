import SwiftUI

struct PersonalizedArticleRow: View {
    let article: Article

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Image
            if let imageUrl = article.imageUrl.flatMap({ URL(string: $0) }) {
                AsyncCachedImage(url: imageUrl, aspectRatio: 16/9)
                    .frame(height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))
            }

            // Category
            if let category = article.category {
                CategoryBadge(category: category)
            }

            // Title
            Text(article.title ?? "Untitled")
                .font(Theme.Fonts.cardTitle())
                .foregroundStyle(Theme.Colors.primaryText)
                .lineLimit(3)

            // Source and time
            HStack {
                if let source = article.source {
                    Text(source)
                        .font(Theme.Fonts.caption())
                        .foregroundStyle(Theme.Colors.secondaryText)
                }
                Spacer()
                TimeAgoText(article.publishedAt)
            }

            // Match tags
            if let reasons = article.matchReasons, !reasons.isEmpty {
                HStack(spacing: 6) {
                    ForEach(reasons.prefix(3), id: \.self) { reason in
                        MatchTagView(text: reason, type: .topic)
                    }
                }
            }
        }
        .padding(Theme.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
    }
}

#Preview {
    PersonalizedArticleRow(article: PreviewData.sampleArticle)
        .padding()
}
