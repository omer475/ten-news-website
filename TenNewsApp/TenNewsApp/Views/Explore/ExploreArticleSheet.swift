import SwiftUI

/// Full-screen overlay that presents an article in the same card design as the main feed,
/// with similar articles available by swiping up.
/// Rendered as an inline overlay (not .fullScreenCover) so the tab bar stays visible.
struct ExploreArticleSheet: View {
    let selectedArticle: Article
    /// Content-fingerprint of `selectedArticle` supplied by the parent. Article's `==`
    /// is id-only (for feed de-duping), which means SwiftUI cannot see when a stub is
    /// hydrated with bullets/details. This String changes whenever the article's
    /// *content* changes, giving SwiftUI a reliable signal to re-run `body` so the
    /// onChange below can mirror the update into `articlePages`.
    let contentKey: String
    let allArticles: [Article]
    let onDismiss: () -> Void
    var preserveOrder: Bool = false

    @State private var pagerIndex: Int = 0
    @State private var articlePages: [Article] = []

    var body: some View {
        ZStack(alignment: .topLeading) {
            Group {
                if !articlePages.isEmpty {
                    VerticalPager(
                        currentIndex: $pagerIndex,
                        pages: articlePages
                    ) { article in
                        ArticleCardView(
                            article: article,
                            accentColor: Self.accentColor(for: article)
                        )
                        // Article's `==` is id-only, so SwiftUI can't see when a stub
                        // is hydrated with bullets. Keying on contentKey forces the
                        // card to rebuild when content arrives.
                        .id(article.contentKey)
                    }
                } else {
                    Color.black
                }
            }

            // Back button
            Button {
                onDismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .glassEffect(.regular, in: Circle())
            }
            .padding(.top, 56)
            .padding(.leading, 20)
            .zIndex(10)
        }
        .ignoresSafeArea()
        .background(Color.black)
        .persistentSystemOverlays(.hidden)
        .onAppear {
            articlePages = buildArticlePages()
        }
        .onChange(of: selectedArticle.id) {
            // Rebuild pages if the selected article identity changes
            articlePages = buildArticlePages()
        }
        .onChange(of: allArticles.count) {
            // More articles loaded (e.g. search results fetched in background)
            // Append new ones without disrupting current pager position
            let currentIds = Set(articlePages.map(\.id.stringValue))
            let newArticles = allArticles.filter { !currentIds.contains($0.id.stringValue) }
            if !newArticles.isEmpty {
                if preserveOrder {
                    articlePages.append(contentsOf: newArticles)
                } else {
                    articlePages = buildArticlePages()
                }
            }
        }
        .onChange(of: contentKey) {
            // Article content was hydrated (bullets/details arrived from the API).
            // Mirror the updated article into articlePages so the pager re-renders.
            if !articlePages.isEmpty, articlePages[0].id == selectedArticle.id {
                articlePages[0] = selectedArticle
            }
        }
    }

    /// Build the page list once — selected article first, then up to 15 similar articles.
    /// When preserveOrder is true, keeps the allArticles order (used for feed continuation).
    private func buildArticlePages() -> [Article] {
        let others = allArticles.filter { $0.id != selectedArticle.id }

        if preserveOrder {
            return [selectedArticle] + others
        }

        let selectedCategory = selectedArticle.category
        let selectedTopics = Set(selectedArticle.topics ?? [])

        let scored = others.map { article -> (Article, Int) in
            var score = 0
            if let cat = selectedCategory, cat == article.category {
                score += 10
            }
            for topic in article.topics ?? [] {
                if selectedTopics.contains(topic) { score += 3 }
            }
            return (article, score)
        }
        let similar = scored
            .sorted { $0.1 > $1.1 }
            .prefix(15)
            .map(\.0)
        return [selectedArticle] + similar
    }

    private static func accentColor(for article: Article) -> Color {
        let categoryColors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
            "Climate": "#339966", "Economy": "#228866",
            "Food": "#E07020", "Fashion": "#BB44AA", "Travel": "#2299BB", "Lifestyle": "#66AA44",
        ]
        let hex = categoryColors[article.category ?? ""] ?? "#3366CC"
        return Color(hex: hex)
    }
}

