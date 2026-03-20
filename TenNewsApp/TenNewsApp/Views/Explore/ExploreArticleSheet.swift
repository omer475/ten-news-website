import SwiftUI

/// Full-screen overlay that presents an article in the same card design as the main feed,
/// with similar articles available by swiping up.
/// Rendered as an inline overlay (not .fullScreenCover) so the tab bar stays visible.
struct ExploreArticleSheet: View {
    let selectedArticle: Article
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
                    }
                } else {
                    Color.black
                }
            }

            // Back button — floating, fades in separately so it doesn't slide up
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
            .transition(.opacity)
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
        .onChange(of: selectedArticle.displayBullets) {
            // Update first page in-place when full content arrives from API
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
        ]
        let hex = categoryColors[article.category ?? ""] ?? "#3366CC"
        return Color(hex: hex)
    }
}
