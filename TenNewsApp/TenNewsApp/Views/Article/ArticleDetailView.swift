import SwiftUI

/// Full article detail page
struct ArticleDetailView: View {
    let articleId: FlexibleID
    let initialArticle: Article?

    @State private var viewModel = ArticleDetailViewModel()
    @Environment(\.dismiss) private var dismiss

    private var article: Article? { viewModel.article ?? initialArticle }

    var body: some View {
        ZStack {
            if let article {
                articleContent(article)
            } else if viewModel.isLoading {
                loadingView
            } else if let error = viewModel.errorMessage {
                errorView(error)
            }

            // Floating navigation bar
            VStack {
                floatingNavBar
                Spacer()
            }
        }
        .ignoresSafeArea()
        .task {
            if let initialArticle {
                viewModel.article = initialArticle
            } else {
                await viewModel.loadArticle(id: articleId.stringValue)
            }
        }
    }

    // MARK: - Floating Navigation Bar

    private var floatingNavBar: some View {
        HStack {
            GlassIconButton(icon: "chevron.left") {
                dismiss()
            }

            Spacer()

            HStack(spacing: 10) {
                GlassIconButton(icon: viewModel.isBookmarked ? "bookmark.fill" : "bookmark") {
                    viewModel.toggleBookmark()
                }

                GlassIconButton(icon: "arrowshape.turn.up.right.fill") {
                    shareArticle()
                }
            }
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.top, 54)
    }

    // MARK: - Article Content

    @ViewBuilder
    private func articleContent(_ article: Article) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Hero image
                heroImage(article)

                // Content
                VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                    // Title
                    Text(article.plainTitle)
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(Theme.Colors.primaryText)
                        .lineSpacing(2)

                    // Source and time
                    HStack(spacing: 8) {
                        if let source = article.source {
                            Text(source)
                                .font(Theme.Fonts.captionMedium())
                                .foregroundStyle(Theme.Colors.accent)
                        }
                        TimeAgoText(article.publishedAt)
                        Spacer()
                        if let category = article.category {
                            CategoryBadge(category: category)
                        }
                    }

                    // Component switcher
                    componentSwitcher(article)

                    // Selected component content
                    componentContent(article)
                }
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.top, Theme.Spacing.lg)
                .padding(.bottom, 100)
            }
        }
    }

    // MARK: - Hero Image

    @ViewBuilder
    private func heroImage(_ article: Article) -> some View {
        if let imageUrl = article.displayImage {
            AsyncCachedImage(url: imageUrl)
                .frame(height: 300)
                .clipped()
        }
    }

    // MARK: - Component Switcher

    @Namespace private var detailSwitcherNamespace

    private func componentSwitcher(_ article: Article) -> some View {
        GlassEffectContainer {
            HStack(spacing: 4) {
                ForEach(viewModel.availableComponents, id: \.self) { type in
                    Button {
                        viewModel.selectComponent(type)
                    } label: {
                        HStack(spacing: 6) {
                            componentSystemImage(for: type)
                                .font(.system(size: 12))
                            Text(componentLabel(for: type))
                                .font(.system(size: 12, weight: .medium))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .glassEffect(
                            viewModel.selectedComponent == type
                                ? .regular.tint(.blue).interactive()
                                : .regular.interactive(),
                            in: Capsule()
                        )
                        .glassEffectID(type, in: detailSwitcherNamespace)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(4)
        }
    }

    @ViewBuilder
    private func componentSystemImage(for type: String) -> some View {
        switch type {
        case "details": Image(systemName: "square.grid.2x2")
        case "timeline": Image(systemName: "calendar.badge.clock")
        case "graph": Image(systemName: "chart.bar")
        case "map": Image(systemName: "map")
        case "five_ws": Image(systemName: "questionmark.circle")
        default: Image(systemName: "doc.text")
        }
    }

    private func componentLabel(for type: String) -> String {
        switch type {
        case "details": return "Summary"
        case "timeline": return "Timeline"
        case "graph": return "Graph"
        case "map": return "Map"
        case "five_ws": return "5Ws"
        default: return type.capitalized
        }
    }

    // MARK: - Component Content

    @ViewBuilder
    private func componentContent(_ article: Article) -> some View {
        switch viewModel.selectedComponent {
        case "details", "five_ws":
            ArticleSummaryView(article: article)
        case "timeline":
            if let timeline = article.timeline, !timeline.isEmpty {
                ArticleTimelineView(entries: timeline)
            } else {
                emptyComponentView("No timeline available")
            }
        case "graph":
            if let graph = article.graph ?? article.graphData {
                ArticleGraphView(graph: graph)
            } else {
                emptyComponentView("No graph data available")
            }
        case "map":
            if let map = article.map ?? article.mapData {
                ArticleMapView(mapData: map)
            } else {
                emptyComponentView("No map data available")
            }
        default:
            ArticleSummaryView(article: article)
        }
    }

    private func emptyComponentView(_ message: String) -> some View {
        Text(message)
            .font(Theme.Fonts.body())
            .foregroundStyle(Theme.Colors.secondaryText)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, Theme.Spacing.xl)
    }

    // MARK: - Loading & Error

    private var loadingView: some View {
        VStack(spacing: 16) {
            LoadingDotsView()
            Text("Loading article...")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(Theme.Colors.warning)
            Text(message)
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)
            Button("Retry") {
                Task { await viewModel.loadArticle(id: articleId.stringValue) }
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }

    // MARK: - Share

    private func shareArticle() {
        guard let article, let urlString = article.url, let url = URL(string: urlString) else { return }
        let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let root = windowScene.windows.first?.rootViewController {
            root.present(activity, animated: true)
        }
    }
}

#Preview {
    ArticleDetailView(
        articleId: FlexibleID("99901"),
        initialArticle: PreviewData.sampleArticle
    )
}
