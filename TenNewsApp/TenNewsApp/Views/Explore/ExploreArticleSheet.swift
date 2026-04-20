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
    /// Hydrated version of selectedArticle (full bullets, components, etc).
    /// Preserved across `allArticles` rebuilds so background feed loads don't wipe it.
    @State private var hydratedPrimary: Article?

    private var primaryArticle: Article { hydratedPrimary ?? selectedArticle }

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
                        // Force re-instantiation when hydration adds bullets/components.
                        // Article: Equatable compares only by id, so SwiftUI otherwise
                        // skips prop updates when pages[0] is replaced with a hydrated copy.
                        .id("\(article.id.stringValue)-b\(article.displayBullets.count)-c\(article.components?.count ?? 0)")
                    }
                } else {
                    Color.black
                }
            }

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
        .task(id: selectedArticle.id.stringValue) {
            let articleId = selectedArticle.id.stringValue
            do {
                let response: ArticleDetailResponse = try await APIClient.shared.get(APIEndpoints.article(id: articleId))
                hydratedPrimary = response.article
                if !articlePages.isEmpty, articlePages[0].id.stringValue == response.article.id.stringValue {
                    articlePages[0] = response.article
                }
            } catch {
                // Silent — user still sees title + image
            }
        }
        .onChange(of: allArticles.count) {
            let currentIds = Set(articlePages.map(\.id.stringValue))
            let newArticles = allArticles.filter { !currentIds.contains($0.id.stringValue) }
            guard !newArticles.isEmpty else { return }
            if preserveOrder {
                articlePages.append(contentsOf: newArticles)
            } else {
                var rebuilt = buildArticlePages()
                // Preserve hydration: replace page 0 with hydrated version if available
                if let hydrated = hydratedPrimary, !rebuilt.isEmpty,
                   rebuilt[0].id.stringValue == hydrated.id.stringValue {
                    rebuilt[0] = hydrated
                }
                articlePages = rebuilt
            }
        }
        .onChange(of: selectedArticle.displayBullets.count) {
            if !articlePages.isEmpty, articlePages[0].id == selectedArticle.id {
                articlePages[0] = selectedArticle
                hydratedPrimary = selectedArticle
            }
        }
    }

    /// Build the page list — primary article first (hydrated if available), then up to 15 similar.
    private func buildArticlePages() -> [Article] {
        let primary = primaryArticle
        let others = allArticles.filter { $0.id != selectedArticle.id }

        if preserveOrder {
            return [primary] + others
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
        return [primary] + similar
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
