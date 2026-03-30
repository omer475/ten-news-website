import SwiftUI

/// Full article detail page with NavigationStack toolbar and ShareLink.
struct ArticleDetailView: View {
    let articleId: FlexibleID
    let initialArticle: Article?

    @State private var viewModel = ArticleDetailViewModel()
    @State private var showSafari = false
    @Environment(\.dismiss) private var dismiss

    private var article: Article? { viewModel.article ?? initialArticle }

    var body: some View {
        Group {
            if let article {
                articleContent(article)
            } else if viewModel.isLoading {
                loadingView
            } else if let error = viewModel.errorMessage {
                errorView(error)
            } else {
                // Fallback: show loading while waiting for .task to fire
                loadingView
            }
        }
        .navigationTitle(article?.source ?? "Article")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.regularMaterial, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    Button {
                        viewModel.toggleBookmark()
                    } label: {
                        Image(systemName: viewModel.isBookmarked(articleId) ? "bookmark.fill" : "bookmark")
                    }

                    if let article, let urlString = article.url, let url = URL(string: urlString) {
                        ShareLink(item: url) {
                            Image(systemName: "square.and.arrow.up")
                        }
                        .simultaneousGesture(TapGesture().onEnded {
                            if let numericId = Int(article.id.stringValue) {
                                Task {
                                    try? await AnalyticsService().track(
                                        event: "article_shared",
                                        articleId: numericId,
                                        category: article.category
                                    )
                                }
                            }
                        })
                    }
                }
            }
        }
        .task {
            if let initialArticle {
                viewModel.article = initialArticle
            } else {
                await viewModel.loadArticle(id: articleId.stringValue, bucket: initialArticle?.bucket)
            }
        }
        .onAppear {
            if let intId = Int(articleId.stringValue) {
                viewModel.startEngagementTracking(articleId: intId, bucket: initialArticle?.bucket)
            }
        }
        .onDisappear {
            if let intId = Int(articleId.stringValue) {
                viewModel.stopEngagementTracking(articleId: intId)
            }
        }
        .sheet(isPresented: $showSafari) {
            if let article, let urlString = article.url, let url = URL(string: urlString) {
                SafariView(url: url)
                    .ignoresSafeArea()
            }
        }
    }

    // MARK: - Article Content

    @ViewBuilder
    private func articleContent(_ article: Article) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let imageUrl = article.displayImage {
                    AsyncCachedImage(url: imageUrl)
                        .frame(height: 260)
                        .frame(maxWidth: .infinity)
                        .clipped()
                }

                VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                    Text(article.plainTitle)
                        .font(.title2.bold())
                        .foregroundStyle(Theme.Colors.primaryText)
                        .lineSpacing(2)

                    HStack(spacing: 8) {
                        if let source = article.source {
                            Button {
                                if article.url != nil {
                                    showSafari = true
                                    Task {
                                        try? await AnalyticsService().track(
                                            event: "source_clicked",
                                            articleId: Int(article.id.stringValue),
                                            category: article.category,
                                            source: article.source
                                        )
                                    }
                                }
                            } label: {
                                Text(source)
                                    .font(Theme.Fonts.captionMedium())
                                    .foregroundStyle(Theme.Colors.accent)
                            }
                            .buttonStyle(.plain)
                        }
                        TimeAgoText(article.publishedAt)
                        Spacer()
                        if let category = article.category {
                            CategoryBadge(category: category)
                        }
                    }

                    componentSwitcher(article)
                    componentContent(article)
                }
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.top, Theme.Spacing.lg)
                .padding(.bottom, 60)
            }
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
                            componentSystemImage(for: type).font(.caption)
                            Text(componentLabel(for: type)).font(.caption.weight(.medium))
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
            ProgressView().controlSize(.large)
            Text("Loading article...")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    NavigationStack {
        ArticleDetailView(
            articleId: FlexibleID("99901"),
            initialArticle: PreviewData.sampleArticle
        )
    }
}
