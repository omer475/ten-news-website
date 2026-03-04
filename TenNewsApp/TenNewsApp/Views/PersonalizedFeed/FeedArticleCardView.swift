import SwiftUI

/// Compact article card for personalized feed
/// Shows image, category, source, time, title, match tags
struct FeedArticleCardView: View {
    let article: Article
    var showMatchTags: Bool = false
    var preferences: UserPreferences? = nil

    @State private var showDetail = false

    var body: some View {
        Button {
            showDetail = true
            HapticManager.light()
        } label: {
            HStack(spacing: 12) {
                // Text content
                VStack(alignment: .leading, spacing: 6) {
                    // Category and source row
                    HStack(spacing: 6) {
                        if let category = article.category {
                            CategoryBadge(category: category)
                        }

                        if let source = article.source {
                            Text(source)
                                .font(Theme.Fonts.footnote())
                                .foregroundStyle(Theme.Colors.secondaryText)
                        }

                        Spacer()

                        TimeAgoText(article.publishedAt ?? article.createdAt)
                    }

                    // Title
                    Text(article.plainTitle)
                        .font(Theme.Fonts.cardTitle())
                        .foregroundStyle(Theme.Colors.primaryText)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                        .lineSpacing(2)

                    // Match tags (for "For You" feed)
                    if showMatchTags {
                        matchTagsRow
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Thumbnail image
                if let imageUrl = article.displayImage {
                    AsyncCachedImage(url: imageUrl)
                        .frame(width: 90, height: 90)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.small))
                }
            }
            .padding(Theme.Spacing.md)
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
        }
        .buttonStyle(.plain)
        .fullScreenCover(isPresented: $showDetail) {
            ArticleDetailView(articleId: article.id, initialArticle: article)
        }
    }

    // MARK: - Match Tags

    @ViewBuilder
    private var matchTagsRow: some View {
        let tags = buildMatchTags()
        if !tags.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(tags, id: \.text) { tag in
                        MatchTagView(text: tag.text, type: tag.type)
                    }
                }
            }
        }
    }

    private func buildMatchTags() -> [(text: String, type: MatchTagView.TagType)] {
        var tags: [(text: String, type: MatchTagView.TagType)] = []
        guard let preferences else { return tags }

        // Match reasons from API
        if let reasons = article.matchReasons {
            for reason in reasons {
                tags.append((text: reason, type: .topic))
            }
            return tags
        }

        // Build from article data
        if let countries = article.countries {
            for countryId in countries {
                if preferences.followedCountries.contains(countryId) {
                    if let country = Countries.find(byId: countryId) {
                        tags.append((text: "\(country.flag) \(country.name)", type: .country))
                    }
                }
            }
        }

        if let topics = article.topics {
            for topicId in topics {
                if preferences.followedTopics.contains(topicId) {
                    if let topic = Topics.find(byId: topicId) {
                        tags.append((text: topic.name, type: .topic))
                    }
                }
            }
        }

        return Array(tags.prefix(3))
    }
}

#Preview("Feed Article Card") {
    VStack(spacing: 12) {
        FeedArticleCardView(
            article: PreviewData.sampleArticle,
            showMatchTags: true,
            preferences: PreviewData.samplePreferences
        )

        FeedArticleCardView(
            article: PreviewData.sampleArticles[1]
        )
    }
    .padding()
}
