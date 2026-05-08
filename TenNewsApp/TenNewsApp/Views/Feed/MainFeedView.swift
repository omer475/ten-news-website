import SwiftUI

/// Full-screen vertical pager (TikTok-style) with swipeable article cards.
struct MainFeedView: View {
    @Binding var currentPageIndex: Int
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(FeedViewModel.self) private var viewModel
    @Environment(TabBarState.self) private var tabBarState
    @State private var showFlashBrief = false

    // Card design variant (2026-05-06): 0 = original TikTok-style full-screen,
    // 1 = Instagram square card, 2 = Apple News modern card. Triple-tap any
    // article in the feed to cycle. Persists across launches via @AppStorage.
    @AppStorage("article_card_style") private var cardStyle: Int = 0

    /// Articles in server-provided order (embedding-personalized).
    private var sortedArticles: [Article] {
        viewModel.articles
    }

    var body: some View {
        ZStack {
            if viewModel.isLoading && sortedArticles.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .transition(.opacity)
            } else if let error = viewModel.errorMessage, sortedArticles.isEmpty {
                errorView(error)
                    .transition(.opacity)
            } else if !sortedArticles.isEmpty {
                feedContent
                    .transition(.opacity)
            } else {
                // Empty articles + no error + not loading = transient state.
                // Trinity v3 should never reach here (always returns ≥1 article
                // and has_more=true). Show a quiet spinner rather than the v11
                // "you're all caught up" page.
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .transition(.opacity)
            }
        }
        .animation(AppAnimations.pageTransition, value: viewModel.isLoading)
        .sheet(isPresented: $showFlashBrief) {
            FlashBriefSheet(
                articles: sortedArticles,
                worldEvents: viewModel.worldEvents,
                timeOfDay: timeOfDay,
                onArticleTap: { index in
                    showFlashBrief = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                            viewModel.currentIndex = index
                        }
                    }
                }
            )
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(28)
        }
        .task {
            if viewModel.allArticles.isEmpty {
                await viewModel.loadInitialData(
                    preferences: appViewModel.preferences,
                    userId: appViewModel.currentUser?.id
                )
                // Start dwell timer for the first card
                viewModel.recordViewStart(at: 0)
            }
        }
        .onChange(of: tabBarState.feedRefreshRequested) { _, requested in
            if requested {
                tabBarState.feedRefreshRequested = false
                Task {
                    await viewModel.refresh()
                    viewModel.currentIndex = 0
                    viewModel.recordViewStart(at: 0)
                }
            }
        }
    }

    // MARK: - Feed Content

    private var feedContent: some View {
        @Bindable var vm = viewModel
        return VerticalPager(
            currentIndex: $vm.currentIndex,
            pages: sortedArticles,
            onRefresh: {
                await viewModel.refresh()
                viewModel.currentIndex = 0
                viewModel.recordViewStart(at: 0)
            }
        ) { article in
            cardForArticle(article)
                // 3-tap to cycle design variants (dev-only, no UI affordance).
                // Triple-tap because single-tap = expand detail, double-tap = like.
                .onTapGesture(count: 3) {
                    cardStyle = (cardStyle + 1) % 3
                }
        }
        .ignoresSafeArea()
        .onChange(of: viewModel.currentIndex) { oldIndex, newIndex in
            // Record signal for the card we just left — this measures dwell time
            // and sends the appropriate event (article_skipped / article_view / article_engaged)
            if oldIndex != newIndex, oldIndex < sortedArticles.count {
                viewModel.recordSwipeAway(fromIndex: oldIndex)
            }

            // Scroll-back detection: swiping backward = strong positive for the revisited article
            if newIndex < oldIndex {
                viewModel.recordRevisit(at: newIndex)
            }

            currentPageIndex = newIndex
            viewModel.recordViewStart(at: newIndex)
            viewModel.trackArticleView(at: newIndex)  // reading history only, no analytics event
            if newIndex >= sortedArticles.count - 5 {
                Task {
                    await viewModel.loadMoreIfNeeded()
                    // If filters removed everything and server has more, keep fetching
                    if newIndex >= sortedArticles.count - 2 && viewModel.hasMore {
                        await viewModel.loadMoreIfNeeded()
                    }
                }
            }
        }
        // Trinity v3: feeds are conceptually unbounded — every fresh request
        // retrieves new candidates after dedup. The CompactCaughtUpBanner is
        // a v11 artifact and contradicts that promise; removed entirely.
    }

    private var timeOfDay: TimeOfDay { .current }

    // MARK: - Card variant switcher (2026-05-06)

    @ViewBuilder
    private func cardForArticle(_ article: Article) -> some View {
        let accent = viewModel.accentColor(for: article)
        switch cardStyle {
        case 1:
            ArticleCardInstagramView(article: article, accentColor: accent)
        case 2:
            ArticleCardNewsCleanView(article: article, accentColor: accent)
        default:
            ArticleCardView(article: article, accentColor: accent)
        }
    }

    // MARK: - Error

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Colors.secondaryText)

            Text("Unable to load news")
                .font(Theme.Fonts.title())
                .foregroundStyle(Theme.Colors.primaryText)

            Text(message)
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)

            GlassCTAButton(title: "Try Again") {
                Task {
                    await viewModel.loadInitialData(
                        preferences: appViewModel.preferences,
                        userId: appViewModel.currentUser?.id
                    )
                }
            }
            .frame(width: 200)
        }
        .padding(Theme.Spacing.xl)
    }
}

#Preview {
    MainFeedView(currentPageIndex: .constant(0))
        .environment(AppViewModel())
        .environment(FeedViewModel())
}


// =============================================================================
// MARK: - Card Variants (2026-05-06)
//
// Two alternative article-card designs. Cycle via triple-tap; setting persists
// in @AppStorage("article_card_style"). Both variants address the user's
// complaint that the original full-screen card zooms the photo to fit
// remaining space after bullets — making short-bullet cards feel "TV-screen"
// and long-bullet cards feel "thumbnail." These use a FIXED photo aspect.
// Reuses existing managers (Like / Bookmark / Share) for parity.
// =============================================================================


/// Variant 1 — Instagram-style square card.
/// Photo is fixed 1:1 aspect, never zoomed/cropped to fit text below.
/// Avatar+source pill overlays the photo top-left; like + bookmark overlay
/// the photo bottom corners. Title + bullets render below the photo on a
/// dark elegant background that matches the existing app aesthetic.
struct ArticleCardInstagramView: View {
    let article: Article
    let accentColor: Color

    @State private var liked = false
    @State private var saved = false
    @State private var showDetail = false
    @State private var showShareSheet = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    Spacer().frame(height: 60)  // top safe area breathing room

                    // — CARD —
                    VStack(spacing: 0) {
                        // Photo + overlays
                        photoBlock
                            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

                        // Caption block
                        captionBlock
                    }
                    .padding(.horizontal, 16)

                    Spacer().frame(height: 100)  // bottom tab bar clearance
                }
            }
        }
        .onTapGesture { showDetail = true }
        .sheet(isPresented: $showDetail) {
            ArticleDetailView(article: article)
        }
        .sheet(isPresented: $showShareSheet) {
            ShareArticleSheet(article: article)
        }
        .onAppear {
            liked = LikeManager.shared.isLiked(article.id)
            saved = BookmarkManager.shared.isBookmarked(article.id)
        }
    }

    private var photoBlock: some View {
        ZStack(alignment: .topLeading) {
            // Fixed 1:1 photo — never zoomed beyond aspect.
            GeometryReader { geo in
                AsyncCachedImage(url: URL(string: article.imageUrl ?? "")) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    accentColor.opacity(0.3)
                }
                .frame(width: geo.size.width, height: geo.size.width)
                .clipped()
            }
            .aspectRatio(1, contentMode: .fit)

            // Source pill (avatar + name) — top-left overlay.
            HStack(spacing: 8) {
                Circle()
                    .fill(accentColor)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Text(String((article.source ?? "T").prefix(1)).uppercased())
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                    )
                VStack(alignment: .leading, spacing: 0) {
                    Text(article.source ?? "Today+")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(article.publishedDate.map { $0.relativeShort } ?? "")
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.7))
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.ultraThinMaterial.opacity(0.8), in: Capsule())
            .padding(12)

            // Like + Save overlay on photo bottom corners.
            VStack {
                Spacer()
                HStack {
                    Button {
                        LikeManager.shared.toggle(article)
                        liked.toggle()
                        HapticManager.light()
                    } label: {
                        Image(systemName: liked ? "heart.fill" : "heart")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(liked ? .red : .white)
                            .padding(10)
                            .background(.black.opacity(0.4), in: Circle())
                    }
                    Text(liked ? "1" : "0")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Button {
                        BookmarkManager.shared.toggle(article)
                        saved.toggle()
                        HapticManager.light()
                    } label: {
                        Image(systemName: saved ? "bookmark.fill" : "bookmark")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(10)
                            .background(.black.opacity(0.4), in: Circle())
                    }
                }
                .padding(12)
            }
        }
    }

    private var captionBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Title
            Text(article.plainTitle)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(3)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Bullets (max 3)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(article.displayBullets.prefix(3).enumerated()), id: \.offset) { _, bullet in
                    HStack(alignment: .top, spacing: 10) {
                        Circle()
                            .fill(accentColor)
                            .frame(width: 4, height: 4)
                            .padding(.top, 8)
                        Text(bullet.replacingOccurrences(of: "**", with: ""))
                            .font(.system(size: 15, weight: .regular))
                            .foregroundStyle(.white.opacity(0.85))
                            .lineSpacing(3)
                            .multilineTextAlignment(.leading)
                    }
                }
            }

            // Comment + share row at bottom
            HStack(spacing: 20) {
                Button {
                    showShareSheet = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrowshape.turn.up.right")
                            .font(.system(size: 14, weight: .medium))
                        Text("Share")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
                Text("Tap to read more →")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.5))
            }
            .padding(.top, 4)
        }
        .padding(16)
    }
}


/// Variant 2 — Apple News / Modern news card.
/// 4:3 photo on top, no overlays. Source pill at top-right above photo,
/// time-ago at top-left. Title + bullets below in a clean light card.
/// Action row at bottom (like, save, share, comment counts).
struct ArticleCardNewsCleanView: View {
    let article: Article
    let accentColor: Color

    @State private var liked = false
    @State private var saved = false
    @State private var showDetail = false
    @State private var showShareSheet = false

    var body: some View {
        ZStack {
            Color(white: 0.06).ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    Spacer().frame(height: 60)

                    VStack(alignment: .leading, spacing: 0) {
                        // Top metadata row (above photo)
                        HStack {
                            Text((article.publishedDate?.relativeShort ?? "now").uppercased())
                                .font(.system(size: 11, weight: .heavy))
                                .foregroundStyle(.white.opacity(0.6))
                                .tracking(0.8)
                            Spacer()
                            Text(article.source ?? "Today+")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(accentColor)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(accentColor.opacity(0.15), in: Capsule())
                        }
                        .padding(.horizontal, 18)
                        .padding(.bottom, 12)

                        // 4:3 fixed-aspect photo (never zoomed beyond)
                        AsyncCachedImage(url: URL(string: article.imageUrl ?? "")) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            accentColor.opacity(0.3)
                        }
                        .aspectRatio(4.0/3.0, contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .padding(.horizontal, 18)

                        // Title
                        Text(article.plainTitle)
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(4)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 18)
                            .padding(.top, 16)

                        // Bullets
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(Array(article.displayBullets.prefix(3).enumerated()), id: \.offset) { _, bullet in
                                HStack(alignment: .top, spacing: 12) {
                                    Rectangle()
                                        .fill(accentColor)
                                        .frame(width: 3, height: 16)
                                        .clipShape(Capsule())
                                    Text(bullet.replacingOccurrences(of: "**", with: ""))
                                        .font(.system(size: 16, weight: .regular))
                                        .foregroundStyle(.white.opacity(0.85))
                                        .lineSpacing(4)
                                }
                            }
                        }
                        .padding(.horizontal, 18)
                        .padding(.top, 14)

                        // Action row
                        HStack(spacing: 24) {
                            actionButton(
                                icon: liked ? "heart.fill" : "heart",
                                tint: liked ? .red : .white.opacity(0.7),
                                label: nil
                            ) {
                                LikeManager.shared.toggle(article)
                                liked.toggle()
                                HapticManager.light()
                            }
                            actionButton(
                                icon: saved ? "bookmark.fill" : "bookmark",
                                tint: saved ? accentColor : .white.opacity(0.7),
                                label: nil
                            ) {
                                BookmarkManager.shared.toggle(article)
                                saved.toggle()
                                HapticManager.light()
                            }
                            actionButton(
                                icon: "arrowshape.turn.up.right",
                                tint: .white.opacity(0.7),
                                label: nil
                            ) {
                                showShareSheet = true
                            }
                            Spacer()
                            Text("Read full →")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(accentColor)
                        }
                        .padding(.horizontal, 18)
                        .padding(.top, 20)
                        .padding(.bottom, 24)
                    }
                    .background(Color(white: 0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .padding(.horizontal, 8)
                    .shadow(color: .black.opacity(0.4), radius: 16, y: 4)

                    Spacer().frame(height: 100)
                }
            }
        }
        .onTapGesture { showDetail = true }
        .sheet(isPresented: $showDetail) {
            ArticleDetailView(article: article)
        }
        .sheet(isPresented: $showShareSheet) {
            ShareArticleSheet(article: article)
        }
        .onAppear {
            liked = LikeManager.shared.isLiked(article.id)
            saved = BookmarkManager.shared.isBookmarked(article.id)
        }
    }

    @ViewBuilder
    private func actionButton(icon: String, tint: Color, label: String?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(tint)
                if let label {
                    Text(label)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(tint)
                }
            }
        }
    }
}


// MARK: - Date helper

private extension Date {
    var relativeShort: String {
        let secs = -timeIntervalSinceNow
        if secs < 60 { return "now" }
        if secs < 3600 { return "\(Int(secs / 60))m" }
        if secs < 86400 { return "\(Int(secs / 3600))h" }
        return "\(Int(secs / 86400))d"
    }
}
