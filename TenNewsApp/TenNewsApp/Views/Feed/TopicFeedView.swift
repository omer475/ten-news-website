import SwiftUI

/// Identifiable wrapper so SwiftUI's `fullScreenCover(item:)` can drive
/// the topic-feed presentation. `sourceId` is the article the chip was
/// tapped from — forwarded to `/api/feed/topic` as `source_id=`, which
/// unlocks the embedding-similarity retrieval lanes server-side.
struct TopicTarget: Identifiable, Hashable {
    let entity: String
    let sourceId: String?
    /// Use entity as the SwiftUI item id so re-tapping the same chip
    /// while a topic feed is already open is a no-op (don't replay).
    var id: String { entity }
}

/// Feed page for a single entity. When a user taps a bold word in a
/// bullet (e.g. **OpenAI**), we present this view full-screen with the
/// entity name in the header and a list of articles tagged with that
/// entity — same `ArticleCardContinuousView` as the main feed so the
/// reading experience is identical, just scoped.
///
/// Recursive entity taps inside this view re-enter `TopicFeedView`
/// covering the current one, so users can drill down freely.
struct TopicFeedView: View {
    let entity: String
    /// Article the chip was tapped from. Passed to `/api/feed/topic` as
    /// `source_id=`, which unlocks the embedding-similarity retrieval
    /// lanes (lane C cosine filter + lane D kNN). Nil for legacy entry
    /// points; endpoint falls back to lexical-only retrieval.
    let sourceId: String?

    @Environment(\.dismiss) private var dismiss
    @State private var articles: [Article] = []
    @State private var isLoading = false
    @State private var hasMore = true
    @State private var errorMessage: String?
    @State private var nestedTarget: TopicTarget? = nil
    /// Tracks scroll offset so the floating header can hide on
    /// downward scroll and re-show on upward scroll (slide-up gesture).
    @State private var headerVisible = true
    @State private var lastScrollOffset: CGFloat = 0

    private let pageSize = 20
    private let service = FeedService()

    var body: some View {
        // ZStack so the chevron + topic name float OVER the scroll
        // content with no white header strip behind them. Header
        // visibility tracks scroll direction (hide on down-scroll,
        // re-show on up-scroll).
        ZStack(alignment: .top) {
            content
            header
                .opacity(headerVisible ? 1 : 0)
                .offset(y: headerVisible ? 0 : -50)
                .animation(.easeInOut(duration: 0.2), value: headerVisible)
        }
        .background(
            Color(red: 0.949, green: 0.949, blue: 0.969)
                .ignoresSafeArea()
        )
        .swipeToDismiss { dismiss() }
        .task { await loadInitial() }
        .fullScreenCover(item: $nestedTarget) { target in
            TopicFeedView(entity: target.entity, sourceId: target.sourceId)
        }
    }

    // MARK: - Header (floats over content, no background fill)

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Color.primary)
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Text(entity)
                .font(.system(size: 22, weight: .bold))
                .tracking(-0.3)
                .foregroundStyle(Color.primary)
                .lineLimit(1)

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if isLoading && articles.isEmpty {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let error = errorMessage, articles.isEmpty {
            errorView(error)
        } else if articles.isEmpty {
            emptyView
        } else {
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 12) {
                    // No top spacer — the first article starts at the
                    // very top edge. The floating chevron + topic name
                    // overlay the article's own header row; we accept
                    // a tiny visual overlap on first render in exchange
                    // for no empty "white strip" between status bar and
                    // photo, which is what the user kept flagging.

                    ForEach(Array(articles.enumerated()), id: \.offset) { idx, article in
                        ArticleCardContinuousView(
                            article: article,
                            accentColor: accentColor(for: article),
                            onTopicTap: { e, srcId in
                                nestedTarget = TopicTarget(entity: e, sourceId: srcId)
                            }
                        )
                        .onAppear {
                            if idx >= articles.count - 4 {
                                Task { await loadMoreIfNeeded() }
                            }
                        }
                    }
                    if isLoading {
                        ProgressView().padding(.vertical, 24)
                    }
                    Spacer().frame(height: 80)
                }
            }
            .refreshable { await refresh() }
            .onScrollGeometryChange(for: CGFloat.self) { geo in
                geo.contentOffset.y
            } action: { oldOffset, newOffset in
                // Hide header on downward scroll past ~30pt; show
                // immediately on any upward motion. Matches IG /
                // Threads / TikTok scroll-driven chrome behavior.
                let delta = newOffset - oldOffset
                if newOffset < 10 {
                    if !headerVisible { headerVisible = true }
                } else if delta > 4 {
                    if headerVisible { headerVisible = false }
                } else if delta < -4 {
                    if !headerVisible { headerVisible = true }
                }
                lastScrollOffset = newOffset
            }
        }
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "tray")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Color(white: 0.55))
            Text("No articles yet")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color(white: 0.30))
            Text("Nothing tagged with \"\(entity)\" right now.")
                .font(.system(size: 14))
                .foregroundStyle(Color(white: 0.50))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private func errorView(_ message: String) -> some View {
        FeedErrorView(
            title: "Articles aren't loading",
            message: message
        ) {
            Task { await loadInitial() }
        }
    }

    // MARK: - Networking

    private func loadInitial() async {
        guard articles.isEmpty, !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let resp = try await service.fetchTopicFeed(
                entity: entity, sourceId: sourceId, offset: 0, limit: pageSize
            )
            articles = resp.articles
            hasMore = resp.articles.count >= pageSize
        } catch {
            errorMessage = "Couldn't load \(entity). Pull to retry."
        }
    }

    private func refresh() async {
        do {
            let resp = try await service.fetchTopicFeed(
                entity: entity, sourceId: sourceId, offset: 0, limit: pageSize
            )
            articles = resp.articles
            hasMore = resp.articles.count >= pageSize
        } catch {
            errorMessage = "Couldn't refresh."
        }
    }

    private func loadMoreIfNeeded() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let resp = try await service.fetchTopicFeed(
                entity: entity,
                sourceId: sourceId,
                offset: articles.count,
                limit: pageSize
            )
            articles.append(contentsOf: resp.articles)
            hasMore = resp.articles.count >= pageSize
        } catch {
            // Silent on pagination failure — keep what we have.
        }
    }

    // MARK: - Helpers

    /// Accent colour matching the main feed: deterministic per-article
    /// hue derived from the article ID. Keeps each card's avatar circle
    /// + bullet dots visually distinct without computing dominant photo
    /// colour off the main thread.
    private func accentColor(for article: Article) -> Color {
        let s = article.id.stringValue
        var hash: UInt64 = 14695981039346656037
        for byte in s.utf8 {
            hash = (hash ^ UInt64(byte)) &* 1099511628211
        }
        let hue = Double(hash % 360) / 360.0
        return Color(hue: hue, saturation: 0.55, brightness: 0.85)
    }
}
