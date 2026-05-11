import SwiftUI
import UIKit

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
                        // article_shared used to fire on simultaneousGesture(TapGesture()),
                        // which triggers when the user TAPS the share button — before
                        // they pick a destination. That inflated share rates by ~3-5x.
                        // Now we present UIActivityViewController directly and fire
                        // article_shared only when completionWithItemsHandler reports
                        // completed=true (user actually picked a destination).
                        Button {
                            ArticleDetailView.presentSystemShare(article: article, url: url)
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                        }
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

    // Presents the system share sheet and only fires article_shared when the
    // user actually completes a share (completionWithItemsHandler.completed
    // is true). Kept static so the toolbar Button has no captured-self issues.
    static func presentSystemShare(article: Article, url: URL) {
        let title = article.displayTitle
        let items: [Any] = ["\(title)\n\(url.absoluteString)"]
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        vc.completionWithItemsHandler = { _, completed, _, _ in
            guard completed, let numericId = Int(article.id.stringValue) else { return }
            Task {
                try? await AnalyticsService().track(
                    event: "article_shared",
                    articleId: numericId,
                    category: article.category
                )
            }
        }
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootVC = window.rootViewController else { return }
        // Find the topmost presented controller so the share sheet appears on
        // top of any modals/full-screen covers already on screen.
        var topVC = rootVC
        while let presented = topVC.presentedViewController { topVC = presented }
        topVC.present(vc, animated: true)
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
