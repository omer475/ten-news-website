import SwiftUI
import MapKit

/// Threads/X-style continuous vertical scroll feed of article cards.
struct MainFeedView: View {
    @Binding var currentPageIndex: Int
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(FeedViewModel.self) private var viewModel
    @Environment(TabBarState.self) private var tabBarState
    @Environment(\.colorScheme) private var colorScheme
    @State private var showFlashBrief = false
    /// Set when the user taps a bold entity in a bullet. Drives the
    /// full-screen topic feed cover.
    @State private var topicTarget: TopicTarget? = nil

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
        .fullScreenCover(item: $topicTarget) { target in
            TopicFeedView(entity: target.entity)
        }
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
        ScrollView(showsIndicators: false) {
            LazyVStack(spacing: 0) {
                ForEach(Array(sortedArticles.enumerated()), id: \.offset) { idx, article in
                    ArticleCardContinuousView(
                        article: article,
                        accentColor: viewModel.accentColor(for: article),
                        onTopicTap: { entity in
                            topicTarget = TopicTarget(entity: entity)
                        }
                    )
                    .padding(.vertical, 14)
                    .onAppear {
                        viewModel.recordViewStart(at: idx)
                        currentPageIndex = idx
                        viewModel.trackArticleView(at: idx)
                        if idx >= sortedArticles.count - 5 {
                            Task { await viewModel.loadMoreIfNeeded() }
                        }
                    }
                    .onDisappear {
                        viewModel.recordSwipeAway(fromIndex: idx)
                    }

                    if idx < sortedArticles.count - 1 {
                        Rectangle()
                            .fill(dividerColor)
                            .frame(height: 0.5)
                            .padding(.horizontal, 16)
                    }
                }
                Spacer().frame(height: 100)
            }
            .padding(.top, 60)
        }
        .ignoresSafeArea()
        .background(
            colorScheme == .dark
                ? Color(red: 0.055, green: 0.055, blue: 0.055)
                : Color(red: 0.965, green: 0.961, blue: 0.949)
        )
        .refreshable {
            await viewModel.refresh()
            viewModel.currentIndex = 0
            viewModel.recordViewStart(at: 0)
        }
    }

    private var timeOfDay: TimeOfDay { .current }

    /// Hairline between cards. ~7% darker than the cream page bg in
    /// light mode, low-opacity white in dark — same logic as the topic
    /// chip background, just thinner. Reads as a quiet parsing cue, not
    /// a hard rule.
    private var dividerColor: Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.07)
                : UIColor(red: 0.86, green: 0.85, blue: 0.82, alpha: 1.0)
        })
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


/// Variant 3 — Instagram-style CONTINUOUS feed card.
/// Combines the original full-screen card's hero photo + side action energy
/// with Apple-News-style cleanliness BELOW the photo. Designed for
/// continuous vertical scroll (not page-snap), so cards stack with small
/// gaps and the user scrolls fluidly like Instagram.
///
/// Layout:
///   - Big photo at natural aspect (max ~600pt height) with rounded top
///   - Glassmorphism source pill overlaying photo top-left
///   - Like + bookmark + share as translucent circles on photo bottom-right
///   - Bold 22pt title below photo
///   - 3 bullets with accent dots
///   - Compact action row + "Read more" CTA
///   - Single rounded card, slight shadow, dark theme
struct ArticleCardContinuousView: View {
    let article: Article
    let accentColor: Color
    /// Invoked when the user taps a bold entity (`**Word**`) in a
    /// bullet. Wired through SwiftUI's `OpenURLAction` so the existing
    /// AttributedString markdown link plumbing dispatches to us.
    var onTopicTap: ((String) -> Void)? = nil
    /// Show the topic-tag chips (search icon + 2 entity capsules) on the
    /// LEFT of the action row. Main feed = true (quick topic jumps).
    /// Explore page = false (the topic is already the section header
    /// above the card, so chips would be redundant clutter).
    var showTopicTags: Bool = true

    @State private var liked = false
    @State private var saved = false
    @State private var following = false
    @State private var showShareSheet = false
    @State private var graphExpanded = false
    @State private var graphAnimated = false
    @State private var mapExpanded = false
    @State private var timelineExpanded = false
    @State private var currentPage = 0
    @State private var selectedComponent: String = ""
    @State private var heartBurstActive = false
    @State private var followBurstActive = false
    @Environment(AppViewModel.self) private var appViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            headerRow

            // Card with stacked-shadow treatment. NO press / tap / long-press
            // gestures on the body — they conflict with vertical scroll on
            // continuous feeds and make swiping feel sluggish.
            // No card wrapper — content sits directly on the cream page
            // bg (Threads / NYT / X pattern). The photo keeps its
            // rounded corners so it still reads as an image; everything
            // else is just typography on the surface. Article-to-article
            // separation comes from the LazyVStack spacing only.
            VStack(alignment: .leading, spacing: 0) {
                if hasImage {
                    photoBlock
                }
                captionBlock
            }

            // Page dots when the article has > 1 page. Sits between the
            // white box and the action row, centered.
            pageDots

            // Action row directly under the box, left-aligned. All
            // three buttons (like / share / save) share the bookmark's
            // plain-icon styling — no glass, no dark fill.
            actionRow
        }
        // 16pt outer margin — Threads / NYT zone. Without a card, the
        // text needs more breathing room from the screen edges than it
        // did when nested inside the white box.
        .padding(.horizontal, 16)
        // Double-tap anywhere on the article container also likes —
        // not just the photo. count==2 ensures single-tap scroll
        // gestures still pass through to the parent ScrollView.
        .contentShape(Rectangle())
        .onTapGesture(count: 2) { handleDoubleTapLike() }
        .sheet(isPresented: $showShareSheet) {
            ShareArticleSheet(article: article)
        }
        // Catch tdtopic://entity/<name> link taps from bullet attributed
        // text and forward the entity to the parent. Falls through to
        // system handling for any other URL (none today, but safe).
        .environment(\.openURL, OpenURLAction { url in
            if url.scheme == "tdtopic" {
                let pathEntity = url.pathComponents.last ?? ""
                let decoded = pathEntity.removingPercentEncoding ?? pathEntity
                let trimmed = decoded.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    onTopicTap?(trimmed)
                }
                return .handled
            }
            return .systemAction
        })
        .onAppear {
            liked = LikeManager.shared.isLiked(article.id)
            saved = BookmarkManager.shared.isBookmarked(article.id)
            following = FollowManager.shared.isFollowing(article.authorId)
        }
    }


    // Header row above the article card. Avatar + source + time on the
    // left; bookmark icon on the right (Instagram pattern: separate
    // "save" from the photo's "react" cluster of heart + share).
    private var headerRow: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(accentColor)
                .frame(width: 32, height: 32)
                .overlay(
                    Text(String((article.source ?? "T").prefix(1)).uppercased())
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                )

            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 5) {
                    Text(article.source ?? "Today+")
                        .font(.system(size: 14, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Color.primary)

                    // Country flag for international stories. Reuters‑style
                    // editorial geo cue — adds a single colorful glyph that
                    // carries real information.
                    if let c = article.countries?.first,
                       let flag = flagEmoji(forCountry: c) {
                        Text(flag).font(.system(size: 14))
                    }

                    // Inline + follow chip — only shown when the article
                    // has a matched publisher and the user isn't already
                    // following them. Disappears as soon as they tap it.
                    if !following, article.authorId != nil {
                        Button {
                            FollowManager.shared.toggle(
                                article.authorId,
                                userId: appViewModel.currentUser?.id,
                                sourceArticleId: Int(article.id.stringValue)
                            )
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            // Show "✓ Following" confirmation for ~0.7s,
                            // THEN flip following=true so the chip
                            // disappears. Visual sequence:
                            //   tap → checkmark pops in → fades → chip
                            //   removed from layout.
                            withAnimation(.spring(response: 0.18, dampingFraction: 0.6)) {
                                followBurstActive = true
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                                withAnimation(.easeOut(duration: 0.2)) {
                                    followBurstActive = false
                                }
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                                    following = true
                                }
                            }
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(accentColor.opacity(followBurstActive ? 1.0 : 0.14))
                                    .frame(width: 18, height: 18)
                                Image(systemName: followBurstActive ? "checkmark" : "plus")
                                    .font(.system(size: 11, weight: .heavy))
                                    .foregroundStyle(followBurstActive ? .white : accentColor)
                                    .scaleEffect(followBurstActive ? 1.15 : 1.0)
                            }
                            .contentShape(Circle())
                        }
                        .buttonStyle(.plain)
                        .padding(.leading, 2)
                    }
                }
                Text(article.publishedDate?.relativeShort ?? "now")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.secondary)
            }

            Spacer()
        }
        .padding(.horizontal, 4)
    }

    /// Action row under the article — topic tags on the LEFT, like /
    /// save / share on the RIGHT. Tags use the same entity-tap pattern
    /// as bullet markdown: tap → opens the topic feed. NYT / Apple News
    /// pattern.
    private var actionRow: some View {
        HStack(spacing: 6) {
            if showTopicTags { topicTags }
            Spacer()
            actionIcon(systemName: liked ? "heart.fill" : "heart",
                       isOn: liked,
                       onColor: Color(red: 0.784, green: 0.212, blue: 0.169)) {
                LikeManager.shared.toggle(article)
                liked.toggle()
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
            actionIcon(systemName: saved ? "bookmark.fill" : "bookmark",
                       isOn: saved,
                       onColor: accentColor) {
                BookmarkManager.shared.toggle(article)
                saved.toggle()
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
            actionIcon(systemName: "arrowshape.turn.up.right",
                       isOn: false,
                       onColor: accentColor) {
                showShareSheet = true
            }
        }
        .padding(.horizontal, 4)
        .padding(.top, 4)
    }

    /// Topic chips, NYT / Apple News editorial pattern. Each entity is
    /// its own self-contained capsule pill — no outer container, no
    /// separators, no search icon. Pill background is a warm tint of
    /// the cream page bg so the chip reads as a "neighbour of the
    /// page", not a foreign gray box. Capped at 2 (research: more
    /// reads as SEO spam on news cards).
    @ViewBuilder
    private var topicTags: some View {
        let entities = uniqueBulletEntities().prefix(2)
        if !entities.isEmpty {
            HStack(spacing: 8) {
                // Bare search icon — no background, leads the row.
                Button {
                    if let first = entities.first { onTopicTap?(first) }
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.secondary)
                        .frame(width: 22, height: 22)
                        .contentShape(Rectangle())
                }
                .buttonStyle(TopicChipButtonStyle())

                ForEach(Array(entities.enumerated()), id: \.offset) { _, tag in
                    Button {
                        onTopicTap?(tag)
                    } label: {
                        Text(tag)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.primary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(topicChipBackground, in: Capsule())
                            .lineLimit(1)
                            .contentShape(Capsule())
                    }
                    .buttonStyle(TopicChipButtonStyle())
                }
            }
        }
    }

    /// Pill background — warm cream in light mode (4% darker than the
    /// page bg, same colour family), low-opacity white in dark mode.
    /// Reads as a quiet neighbour of the surface, not a foreign chip.
    private var topicChipBackground: Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.08)
                : UIColor(red: 0.929, green: 0.918, blue: 0.886, alpha: 1.0)
        })
    }

    /// Pull all `**Entity**` spans out of the article's display bullets,
    /// dedupe case-insensitively, return the first 3 in their original
    /// case. Filters out numeric / measurement tags ("5,000", "70
    /// languages", "$50B", "23%", "Wednesday") which the AI also wraps
    /// in `**…**` for emphasis but make terrible topic chips.
    private func uniqueBulletEntities() -> [String] {
        var out: [String] = []
        var seen = Set<String>()
        for bullet in article.displayBullets {
            let parts = bullet.components(separatedBy: "**")
            for (i, part) in parts.enumerated() where i % 2 == 1 {
                let trimmed = part.trimmingCharacters(in: .whitespacesAndNewlines)
                guard isPlausibleTopicEntity(trimmed) else { continue }
                let key = trimmed.lowercased()
                if seen.insert(key).inserted {
                    out.append(trimmed)
                    if out.count >= 3 { return out }
                }
            }
        }
        return out
    }

    /// Only treat a `**…**` span as a topic-tag candidate when it looks
    /// like a NAMED ENTITY, not a number / date / measurement.
    /// Reject heuristics:
    ///   - starts with a digit or currency symbol
    ///   - more than 30% of chars are digits
    ///   - is a stand-alone weekday or month
    ///   - shorter than 2 chars
    private func isPlausibleTopicEntity(_ raw: String) -> Bool {
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard s.count >= 2 else { return false }

        if let first = s.first {
            if first.isNumber { return false }
            if "$€£¥".contains(first) { return false }
        }
        // Trailing % or numeric units → reject ("23%", "5x", etc.)
        if s.hasSuffix("%") { return false }

        let digitCount = s.filter(\.isNumber).count
        let alphaCount = s.filter(\.isLetter).count
        if alphaCount == 0 { return false }
        if Double(digitCount) / Double(s.count) > 0.30 { return false }

        let lower = s.lowercased()
        let weekdays: Set<String> = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
        let months: Set<String> = ["january","february","march","april","may","june","july","august","september","october","november","december"]
        if weekdays.contains(lower) || months.contains(lower) { return false }

        return true
    }

    private func actionIcon(systemName: String, isOn: Bool, onColor: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(isOn ? onColor : Color.secondary)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .scaleEffect(isOn ? 1.10 : 1.0)
        // Snappy bounce — response 0.20 (was 0.30) so the pop reads
        // immediately on tap. Higher amplitude (1.10 vs 1.05) makes
        // the visual feedback obvious at a glance.
        .animation(.spring(response: 0.20, dampingFraction: 0.55), value: isOn)
    }

    private var readMinutes: Int? {
        guard let secs = article.expectedReadSeconds, secs > 0 else { return nil }
        let m = Int((secs / 60).rounded(.up))
        return max(1, m)
    }

    /// Image is optional from 2026-05-07. Treat empty / null / placeholder
    /// strings the same as missing — the photo block disappears and the
    /// title leads the white box.
    private var hasImage: Bool {
        guard let s = article.imageUrl?.trimmingCharacters(in: .whitespacesAndNewlines),
              !s.isEmpty else { return false }
        let lower = s.lowercased()
        return lower != "null" && lower != "none" && lower != "undefined" && s.count >= 5
    }

    // Photo only — no overlay buttons. Like / share / save have moved
    // to the action row beneath the article. Corners are uniform now
    // that there's no surrounding card to match against. Double-tap
    // anywhere on the photo likes the article (Instagram pattern).
    private var photoBlock: some View {
        ZStack {
            // 16:9 forced aspect + .fill: low-res thumbnails scale up to
            // fill card width (no more "tiny image floating in space" for
            // small thumbnails), and tall/square images get cropped to a
            // consistent 16:9 frame so every card has the same image height.
            AsyncCachedImage(url: URL(string: article.imageUrl ?? ""), aspectRatio: 16.0 / 9.0, contentMode: .fill)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .onTapGesture(count: 2) { handleDoubleTapLike() }

            // Heart burst — pops over the photo center for ~0.6s after a
            // double-tap. Pure visual feedback; doesn't block taps.
            if heartBurstActive {
                Image(systemName: "heart.fill")
                    .font(.system(size: 96, weight: .heavy))
                    .foregroundStyle(Color.white)
                    .shadow(color: .black.opacity(0.25), radius: 12, x: 0, y: 4)
                    .scaleEffect(heartBurstActive ? 1.0 : 0.4)
                    .opacity(heartBurstActive ? 1.0 : 0.0)
                    .allowsHitTesting(false)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.bottom, 12)
    }

    /// Double-tap-to-like handler. Always sets the article to LIKED
    /// (never un-likes — Instagram pattern). Triggers a 0.6s heart-
    /// burst overlay regardless of whether liked-state actually changed
    /// so the user always sees feedback for their tap.
    private func handleDoubleTapLike() {
        if !liked {
            LikeManager.shared.toggle(article)
            liked = true
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
        withAnimation(.spring(response: 0.32, dampingFraction: 0.55)) {
            heartBurstActive = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            withAnimation(.easeOut(duration: 0.2)) {
                heartBurstActive = false
            }
        }
    }

    private func photoIconButton(systemName: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 40, height: 40)
                .background(.black.opacity(0.5), in: Circle())
        }
    }

    // Typography spec from Threads / X / Reddit research:
    //   Title:    22pt semibold, -0.4 tracking, color #0A0A0A
    //   Body:     16pt regular, +5 lineSpacing (~1.31 line-height), #1F1F1F
    //   Title→body gap = 14pt; bullet→bullet gap = 10pt
    //   Padding 18pt horizontal, 18pt top, 16pt bottom
    //   Title color is 12% darker than body — subtle weight delta makes
    //   the title FEEL like a title without bullying through size alone.
    /// Pages used for the horizontal swipe carousel inside the white box.
    /// When the AI generated multi-page content (recipes, stock analyses,
    /// stories), `article.pages` contains 2-10 entries — page 0 is page 1
    /// (article title + bullets). For single-page articles this returns
    /// an empty array and we render the legacy single-page layout.
    private var carouselPages: [ArticlePage] {
        let p = article.pages ?? []
        return p.count > 1 ? p : []
    }

    @ViewBuilder
    private var captionBlock: some View {
        if carouselPages.isEmpty {
            singlePageCaption
        } else {
            multiPageCaption
        }
    }

    /// Single-page layout: section cap + title + bullets + components.
    /// Used when `article.pages` is null or has a single page.
    private var singlePageCaption: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let label = sectionLabelText, !label.isEmpty {
                Text(label.uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(sectionColor(for: article.category ?? ""))
                    .lineLimit(1)
            }

            Text(article.plainTitle)
                .font(.system(size: 24, weight: .bold))
                .tracking(-0.5)
                .lineSpacing(2)
                .foregroundStyle(Color.primary)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)

            if !article.displayBullets.isEmpty {
                bulletList(article.displayBullets)
            }

            componentSections
        }
        // No horizontal inset — caption aligns flush with photo edges
        // since there's no card to nest within.
        .padding(.top, hasImage ? 4 : 18)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Multi-page TabView. Page 0 renders article title + bullets +
    /// components. Pages 1+ render their heading (when present) + their
    /// own bullets. Components stay anchored to page 0 because they
    /// describe the article overall, not a step.
    private var multiPageCaption: some View {
        TabView(selection: $currentPage) {
            ForEach(Array(carouselPages.enumerated()), id: \.offset) { idx, page in
                pageContent(idx: idx, page: page)
                    .tag(idx)
                    .padding(.top, hasImage ? 4 : 18)
                    .padding(.bottom, 12)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(height: 380)  // fixed safe height for multi-page mode
    }

    @ViewBuilder
    private func pageContent(idx: Int, page: ArticlePage) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if idx == 0 {
                if let label = sectionLabelText, !label.isEmpty {
                    Text(label.uppercased())
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(0.8)
                        .foregroundStyle(sectionColor(for: article.category ?? ""))
                        .lineLimit(1)
                }
                Text(article.plainTitle)
                    .font(.system(size: 24, weight: .bold))
                    .tracking(-0.5)
                    .lineSpacing(2)
                    .foregroundStyle(Color.primary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else if let heading = page.title, !heading.isEmpty {
                // Sub-page heading — smaller than the main title so the
                // hierarchy reads "Recipe → Step 3" not two competing
                // titles.
                Text(heading)
                    .font(.system(size: 19, weight: .semibold))
                    .tracking(-0.3)
                    .foregroundStyle(Color.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            let pageBullets = page.bullets ?? (idx == 0 ? article.displayBullets : [])
            if !pageBullets.isEmpty {
                bulletList(pageBullets)
            }

            if idx == 0 {
                componentSections
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Shared bullet renderer (single-page, multi-page, all variants).
    private func bulletList(_ bullets: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(bullets.prefix(3).enumerated()), id: \.offset) { _, bullet in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Circle()
                        .fill(accentColor.opacity(0.70))
                        .frame(width: 4, height: 4)
                        .alignmentGuide(.firstTextBaseline) { d in d[.bottom] + 1 }
                    Text(bulletAttributed(bullet))
                        .font(.system(size: 16))
                        .foregroundStyle(Color.primary)
                        .lineSpacing(5)
                        .multilineTextAlignment(.leading)
                        .tint(Color.primary)
                }
            }
        }
    }

    /// Page dots — TikTok-style, accent dot for the current page, gray
    /// for the rest. Only rendered when there's actually more than one
    /// page; placement is between the white box and the action row.
    @ViewBuilder
    private var pageDots: some View {
        if carouselPages.count > 1 {
            HStack(spacing: 6) {
                ForEach(0..<carouselPages.count, id: \.self) { i in
                    Circle()
                        .fill(i == currentPage ? accentColor : Color.secondary.opacity(0.45))
                        .frame(width: i == currentPage ? 7 : 6, height: i == currentPage ? 7 : 6)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentPage)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
        }
    }

    /// Components that have actual payload, in the AI-specified
    /// `componentsOrder`. We deliberately skip `summary` / `five_ws`
    /// (already covered by bullets) and components without a renderer
    /// in this card variant (`scorecard`, `recipe`).
    private var availableComponents: [String] {
        let order = (article.components ?? []).map { $0.lowercased() }
        let supported: Set<String> = ["details", "timeline", "graph", "map"]
        let filtered = order.filter { supported.contains($0) && componentHasData($0) }
        // Fall back to detection if `components` is empty/missing.
        if !filtered.isEmpty { return filtered }
        return supported.filter { componentHasData($0) }.sorted()
    }

    private func componentHasData(_ type: String) -> Bool {
        switch type {
        case "details":
            let d = article.details ?? article.detailsB2
            return !(d?.isEmpty ?? true)
        case "timeline":
            return !(article.timeline?.isEmpty ?? true)
        case "graph":
            return (article.graph ?? article.graphData) != nil
        case "map":
            return (article.map ?? article.mapData) != nil
        default:
            return false
        }
    }

    @ViewBuilder
    private var componentSections: some View {
        let comps = availableComponents
        if !comps.isEmpty {
            // Active component renders, with the glass-pill switcher
            // overlaid at top-LEFT (only when >1 component exists). The
            // expand button stays top-RIGHT — the two share the top row
            // of the info box, matching the original `ArticleCardView`
            // pattern.
            VStack(alignment: .leading, spacing: 8) {
                componentRow(activeComponent(in: comps))
                    .contentShape(Rectangle())
                    .onTapGesture {
                        // Tap on the body of the info box advances to
                        // the next component in the rotation. Switcher
                        // pills + expand button remain higher-priority
                        // taps (Button > parent .onTapGesture in SwiftUI).
                        guard comps.count > 1 else { return }
                        advanceComponent(in: comps)
                    }
                if comps.count > 1 {
                    HStack {
                        Spacer()
                        IconOnlyComponentSwitcher(
                            components: comps,
                            selected: switcherBinding(for: comps)
                        )
                        Spacer()
                    }
                }
            }
        }
    }

    /// Resolved active component: `selectedComponent` if it's still in
    /// the available list, else the first available. Robust to data
    /// changes (e.g. when the article gets re-fetched and components
    /// shift) without losing user intent.
    private func activeComponent(in comps: [String]) -> String {
        if comps.contains(selectedComponent) { return selectedComponent }
        return comps.first ?? "details"
    }

    /// Cycle to the next available component (wraps at end). Triggered
    /// by tapping the body of the info box when more than one component
    /// is available.
    private func advanceComponent(in comps: [String]) {
        let current = activeComponent(in: comps)
        let idx = comps.firstIndex(of: current) ?? 0
        let next = (idx + 1) % comps.count
        withAnimation(.spring(response: 0.18, dampingFraction: 0.7)) {
            selectedComponent = comps[next]
        }
        HapticManager.selection()
    }

    /// Binding that initializes `selectedComponent` lazily on first
    /// access — keeps the @State default "" valid until the article
    /// is mounted, then snaps to the first available component.
    private func switcherBinding(for comps: [String]) -> Binding<String> {
        Binding(
            get: { activeComponent(in: comps) },
            set: { selectedComponent = $0 }
        )
    }

    @ViewBuilder
    private func componentRow(_ type: String) -> some View {
        switch type {
        case "details":
            if let details = article.details ?? article.detailsB2, !details.isEmpty {
                detailsList(details)
            }
        case "timeline":
            if let timeline = article.timeline, !timeline.isEmpty {
                whiteCompactTimeline(entries: timeline)
            }
        case "graph":
            if let graph = article.graph ?? article.graphData,
               let points = graph.data, !points.isEmpty {
                whiteCompactGraph(points: points, graph: graph)
            }
        case "map":
            if let map = article.map ?? article.mapData {
                whiteCompactMap(mapData: map)
            }
        default:
            EmptyView()
        }
    }

    /// White-card variant of `compactGraph`. Same layout as the live
    /// `ArticleCardView` design — sparkline strip when collapsed, full
    /// bar chart when expanded — but with white box, near-black text,
    /// and the matching border/shadow used by `detailsList`.
    /// Minimal sparkline: continuous line over the points with a peak
    /// dot + a soft accent fill below. No per-point labels, no axes.
    /// Apple Stocks / Apple Health data-callout style.
    private func sparkline(points: [GraphPoint], maxVal: Double, minVal: Double, maxIdx: Int, height: CGFloat) -> some View {
        GeometryReader { geo in
            let span = max(maxVal - minVal, 0.0001)
            let positions: [CGPoint] = points.enumerated().map { i, p in
                let x = points.count > 1
                    ? CGFloat(i) / CGFloat(points.count - 1) * geo.size.width
                    : geo.size.width / 2
                let y = (1 - CGFloat((p.displayValue - minVal) / span)) * geo.size.height
                return CGPoint(x: x, y: y)
            }

            ZStack {
                // Soft fill below the line for visual weight.
                Path { path in
                    guard let first = positions.first else { return }
                    path.move(to: CGPoint(x: first.x, y: geo.size.height))
                    path.addLine(to: first)
                    for p in positions.dropFirst() {
                        path.addLine(to: p)
                    }
                    if let last = positions.last {
                        path.addLine(to: CGPoint(x: last.x, y: geo.size.height))
                    }
                    path.closeSubpath()
                }
                .fill(LinearGradient(
                    colors: [accentColor.opacity(0.18), accentColor.opacity(0.0)],
                    startPoint: .top,
                    endPoint: .bottom
                ))

                // Line.
                Path { path in
                    guard let first = positions.first else { return }
                    path.move(to: first)
                    for p in positions.dropFirst() {
                        path.addLine(to: p)
                    }
                }
                .stroke(accentColor, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))

                // Peak dot.
                if positions.indices.contains(maxIdx) {
                    Circle()
                        .fill(accentColor)
                        .frame(width: 7, height: 7)
                        .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                        .position(positions[maxIdx])
                }
            }
        }
        .frame(height: height)
    }

    private func whiteCompactGraph(points: [GraphPoint], graph: GraphData) -> some View {
        let maxVal = points.map(\.displayValue).max() ?? 1
        let minVal = points.map(\.displayValue).min() ?? 0
        let maxIdx = points.enumerated().max(by: { $0.element.displayValue < $1.element.displayValue })?.offset ?? 0

        // Minimal redesign: single-line sparkline with one peak callout,
        // no per-point labels. Threads / Apple News data-callout style.
        return VStack(spacing: 0) {
            if graphExpanded {
                // Expanded: full sparkline with start/end value labels +
                // peak label. Still no per-point clutter.
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        if let title = graph.title, !title.isEmpty {
                            Text(title.uppercased())
                                .font(.system(size: 10, weight: .heavy))
                                .tracking(1.2)
                                .foregroundStyle(Color.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text(formatStatValue(maxVal))
                            .font(.system(size: 26, weight: .heavy))
                            .foregroundStyle(accentColor)
                        Text("peak")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.secondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 14)

                    sparkline(points: points, maxVal: maxVal, minVal: minVal, maxIdx: maxIdx, height: 140)
                        .padding(.horizontal, 16)
                        .padding(.top, 4)

                    HStack {
                        if let first = points.first {
                            Text(first.displayLabel)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(Color.secondary)
                        }
                        Spacer()
                        if let last = points.last {
                            Text(last.displayLabel)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(Color.secondary)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 14)
                }
                .frame(height: 240)
            } else {
                // Collapsed: title + peak number on left, sparkline on right.
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        if let title = graph.title, !title.isEmpty {
                            Text(title.uppercased())
                                .font(.system(size: 9, weight: .heavy))
                                .tracking(1.0)
                                .foregroundStyle(Color.secondary)
                                .lineLimit(1)
                        }
                        Text(formatStatValue(maxVal))
                            .font(.system(size: 22, weight: .heavy))
                            .foregroundStyle(accentColor)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                    .frame(width: 96, alignment: .leading)
                    .padding(.leading, 16)

                    sparkline(points: points, maxVal: maxVal, minVal: minVal, maxIdx: maxIdx, height: 44)
                        .padding(.trailing, 50)
                }
                .frame(height: 92)
            }
        }
        // Untinted iOS 26 Liquid Glass — pure material, no shadow.
        // Liquid Glass material restored. Wrapped in compositingGroup
        // and given a slight clear-shadow override so the intrinsic
        // halo reads softer than default but stays present.
        .glassEffect(
            .regular.interactive(),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
        .compositingGroup()
        .shadow(color: .black.opacity(0.04), radius: 4, x: 0, y: 1)
        .overlay(alignment: .topTrailing) {
            expandButton(isExpanded: graphExpanded) {
                graphExpanded.toggle()
                if graphExpanded {
                    withAnimation(.easeOut(duration: 0.6).delay(0.15)) { graphAnimated = true }
                } else {
                    graphAnimated = false
                }
            }
        }
        .animation(.spring(response: 0.22, dampingFraction: 0.78), value: graphExpanded)
    }

    /// White-card variant of `compactMap`.
    private func whiteCompactMap(mapData: MapData) -> some View {
        let locations = mapData.allLocations
        let region: MKCoordinateRegion = {
            guard !locations.isEmpty else {
                return MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: 20, longitude: 0),
                    span: MKCoordinateSpan(latitudeDelta: 60, longitudeDelta: 60)
                )
            }
            let lats = locations.map(\.latitude)
            let lons = locations.map(\.longitude)
            let centerLat = (lats.min()! + lats.max()!) / 2
            let centerLon = (lons.min()! + lons.max()!) / 2
            let spanLat = max((lats.max()! - lats.min()!) * 1.8, 2)
            let spanLon = max((lons.max()! - lons.min()!) * 1.8, 2)
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: centerLat, longitude: centerLon),
                span: MKCoordinateSpan(latitudeDelta: spanLat, longitudeDelta: spanLon)
            )
        }()

        let locationName = mapData.name ?? mapData.city ?? ""
        let locationDetail = [mapData.city, mapData.country].compactMap { $0 }.joined(separator: ", ")
        let mapHeight: CGFloat = mapExpanded ? 240 : 92

        return Map(initialPosition: .region(region), interactionModes: mapExpanded ? [.zoom, .pan] : []) {
            ForEach(Array(locations.enumerated()), id: \.offset) { _, location in
                Annotation("",
                           coordinate: CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude)) {
                    Circle()
                        .fill(accentColor)
                        .frame(width: 10, height: 10)
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                        .shadow(color: .black.opacity(0.3), radius: 3, y: 1)
                }
            }
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
        .frame(height: mapHeight)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(alignment: .topTrailing) {
            expandButton(isExpanded: mapExpanded) { mapExpanded.toggle() }
        }
        .overlay(alignment: .bottomLeading) {
            if !locationName.isEmpty || !locationDetail.isEmpty {
                HStack(spacing: 5) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(accentColor)
                    Text(locationDetail.isEmpty ? locationName : locationDetail)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.primary)
                        .lineLimit(1)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .glassEffect(.regular.interactive(), in: Capsule())
                .padding(8)
            }
        }
        .animation(.spring(response: 0.22, dampingFraction: 0.78), value: mapExpanded)
    }

    /// White-card variant of `compactTimeline`.
    private func whiteCompactTimeline(entries: [TimelineEntry]) -> some View {
        let contentHeight = min(CGFloat(entries.count) * 80 + 28, 320)

        return VStack(spacing: 0) {
            if timelineExpanded {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(entries.enumerated()), id: \.offset) { idx, entry in
                            HStack(alignment: .top, spacing: 12) {
                                VStack(spacing: 0) {
                                    Circle()
                                        .fill(idx == 0 ? accentColor : accentColor.opacity(0.5))
                                        .frame(width: 8, height: 8)
                                        .overlay(
                                            Circle()
                                                .stroke(accentColor.opacity(0.3), lineWidth: idx == 0 ? 3 : 0)
                                                .frame(width: 14, height: 14)
                                        )
                                    if idx < entries.count - 1 {
                                        Rectangle()
                                            .fill(accentColor.opacity(0.20))
                                            .frame(width: 1.5)
                                            .frame(minHeight: 28)
                                    }
                                }
                                .padding(.top, 2)

                                VStack(alignment: .leading, spacing: 3) {
                                    if let date = entry.date, !date.isEmpty {
                                        Text(date)
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundStyle(accentColor)
                                            .tracking(0.3)
                                    }
                                    Text(entry.displayText)
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundStyle(Color.primary)
                                        .lineSpacing(2)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(.bottom, idx < entries.count - 1 ? 8 : 0)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(height: contentHeight)
            } else {
                let displayEntries = Array(entries.prefix(3))
                HStack(alignment: .top, spacing: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(displayEntries.enumerated()), id: \.offset) { idx, _ in
                            Circle()
                                .fill(idx == 0 ? accentColor : accentColor.opacity(0.40))
                                .frame(width: 5, height: 5)
                            if idx < displayEntries.count - 1 {
                                Rectangle()
                                    .fill(accentColor.opacity(0.20))
                                    .frame(width: 1)
                                    .frame(maxHeight: .infinity)
                            }
                        }
                    }
                    .padding(.leading, 14)
                    .padding(.vertical, 16)

                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(displayEntries.enumerated()), id: \.offset) { _, entry in
                            HStack(spacing: 6) {
                                if let date = entry.date {
                                    Text(date)
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundStyle(accentColor)
                                        .frame(width: 58, alignment: .leading)
                                }
                                Text(entry.displayText)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(Color.primary)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(maxHeight: .infinity)
                        }
                    }
                    .padding(.leading, 10)
                    .padding(.trailing, 50)
                }
                .frame(height: 92)
            }
        }
        // Liquid Glass material restored. Wrapped in compositingGroup
        // and given a slight clear-shadow override so the intrinsic
        // halo reads softer than default but stays present.
        .glassEffect(
            .regular.interactive(),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
        .compositingGroup()
        .shadow(color: .black.opacity(0.04), radius: 4, x: 0, y: 1)
        .overlay(alignment: .topTrailing) {
            expandButton(isExpanded: timelineExpanded) { timelineExpanded.toggle() }
        }
        .animation(.spring(response: 0.22, dampingFraction: 0.78), value: timelineExpanded)
    }

    /// Shared expand/collapse pill — accent-tinted background, dark
    /// glyph; matches the white-box aesthetic across all components.
    private func expandButton(isExpanded: Bool, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.78)) {
                action()
            }
            HapticManager.light()
        } label: {
            Image(systemName: isExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.primary)
                .frame(width: 28, height: 28)
                .glassEffect(.regular.interactive(), in: Circle())
        }
        .padding(8)
    }

    /// 1K/1M/1B-style stat formatter — same shape as the live card.
    private func formatStatValue(_ value: Double) -> String {
        if value >= 1_000_000_000 {
            return String(format: "%.1fB", value / 1_000_000_000)
        } else if value >= 1_000_000 {
            return String(format: "%.1fM", value / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "%.1fK", value / 1_000)
        } else if value == value.rounded() {
            return String(format: "%.0f", value)
        } else {
            return String(format: "%.1f", value)
        }
    }

    /// Render a detail value with ONLY the numeric portion in accent
    /// color, the rest in primary text. e.g. "5 aboard" → "5" accent +
    /// " aboard" primary; "$1.5M" → all accent (entire string is the
    /// number+symbol). Picks up the first run of digits + adjacent
    /// currency/percent/decimal characters as the "numeric" span.
    private func detailValueAttributed(_ raw: String) -> AttributedString {
        let cleaned = raw.replacingOccurrences(of: "**", with: "")
        guard let range = cleaned.range(
            of: #"[\$€£¥]?[\d][\d,\.]*[%KMBkmb\+\-]?"#,
            options: .regularExpression
        ) else {
            return AttributedString(cleaned, attributes: AttributeContainer().foregroundColor(Color.primary))
        }
        let before = String(cleaned[cleaned.startIndex..<range.lowerBound])
        let number = String(cleaned[range])
        let after = String(cleaned[range.upperBound...])

        var out = AttributedString()
        if !before.isEmpty {
            out.append(AttributedString(before, attributes: AttributeContainer().foregroundColor(Color.primary)))
        }
        out.append(AttributedString(number, attributes: AttributeContainer().foregroundColor(accentColor)))
        if !after.isEmpty {
            out.append(AttributedString(after, attributes: AttributeContainer().foregroundColor(Color.primary)))
        }
        return out
    }

    /// 3-column liquid-glass stat box — same iOS 26 Liquid Glass recipe
    /// as the bottom tab bar (`.regular.tint(.black.opacity(0.20)).interactive()`).
    /// Wrapped in `GlassEffectContainer` so the lensing reads against
    /// the article photo / page bg behind. White text on darkened glass.
    private func detailsList(_ details: [DetailItem]) -> some View {
        let displayItems = Array(details.prefix(3))
        return GlassEffectContainer {
            HStack(spacing: 0) {
                ForEach(Array(displayItems.enumerated()), id: \.offset) { idx, item in
                    VStack(spacing: 5) {
                        Text(item.displayLabel.uppercased())
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(Color.secondary)
                            .tracking(0.6)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .multilineTextAlignment(.center)

                        Text(detailValueAttributed(item.displayValue))
                            .font(.system(size: 20, weight: .heavy))
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)

                    if idx < displayItems.count - 1 {
                        Rectangle()
                            .fill(Color.primary.opacity(0.12))
                            .frame(width: 1, height: 36)
                    }
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 92)
            .glassEffect(
                .regular.interactive(),
                in: RoundedRectangle(cornerRadius: 22, style: .continuous)
            )
            .compositingGroup()
            .shadow(color: .black.opacity(0.04), radius: 4, x: 0, y: 1)
        }
    }

    /// Parse a detail value into a (main, subtitle) pair. If the value
    /// uses `**bold**` markdown the bold span becomes the main; if no
    /// markdown, the first numeric run is treated as the main value.
    private func parseDetailValue(_ text: String) -> (main: String, subtitle: String) {
        let parts = text.components(separatedBy: "**")
        if parts.count >= 3 {
            let main = parts[1].trimmingCharacters(in: .whitespaces)
            let rest = (parts[0] + parts[2]).trimmingCharacters(in: .whitespaces)
            return (main, rest)
        }
        let val = text.trimmingCharacters(in: .whitespaces)
        if let range = val.range(of: #"[\d][^\p{Ll}]*"#, options: .regularExpression) {
            let number = String(val[range]).trimmingCharacters(in: .whitespaces)
            let before = String(val[val.startIndex..<range.lowerBound]).trimmingCharacters(in: .whitespaces)
            let after = String(val[range.upperBound...]).trimmingCharacters(in: .whitespaces)
            let rest = [before, after].filter { !$0.isEmpty }.joined(separator: " ")
            return (number, rest)
        }
        return (val, "")
    }

    /// Build an AttributedString from `**word**`-style bullet markdown.
    /// Spans inside `**…**` become semibold + tappable links via the
    /// custom `tdtopic://` URL scheme. The handler in MainFeedView
    /// catches that scheme and pushes the topic feed.
    private func bulletAttributed(_ raw: String) -> AttributedString {
        var out = AttributedString()
        let parts = raw.components(separatedBy: "**")
        for (i, part) in parts.enumerated() {
            guard !part.isEmpty else { continue }
            var span = AttributedString(part)
            if i % 2 == 1 {
                // Entity span: bold for emphasis, NO underline, NO link.
                // Entities are now surfaced as tappable pills in the
                // action row instead — keeps the bullet body clean.
                span.font = .system(size: 16, weight: .semibold)
                span.foregroundColor = Color.primary
            }
            out += span
        }
        return out
    }

    /// Editorial label above the title. ONLY the article's world-event
    /// name (when the AI clustered this article into an ongoing story,
    /// e.g. "OPEC Meeting Aug 2025"). No category, no topics — the user
    /// doesn't want generic section words like "BUSINESS" appearing on
    /// cards. If there's no world event, the label is suppressed
    /// entirely and the title sits flush at the top of the caption.
    private var sectionLabelText: String? {
        guard let we = article.worldEvent?.name, !we.isEmpty else { return nil }
        return we
    }

    /// Per-category section color (Apple News / NYT pattern). Brand
    /// colors are bright enough to read in both light + dark modes
    /// (tech teal, sports orange, etc.). For categories that would
    /// land on near-black (politics, default), we delegate to
    /// `Color.primary` which auto-flips white in dark mode.
    private func sectionColor(for category: String) -> Color {
        switch category.lowercased() {
        case "politics":              return Color.primary
        case "tech", "technology":    return Color(red: 0.10, green: 0.62, blue: 0.78)  // teal-blue (lifted for dark mode)
        case "business", "finance":   return Color(red: 0.20, green: 0.50, blue: 0.85)  // brighter navy
        case "sports":                return Color(red: 1.00, green: 0.55, blue: 0.10)  // editorial orange
        case "entertainment",
             "culture", "fashion":    return Color(red: 0.62, green: 0.32, blue: 0.82)  // brighter purple
        case "world":                 return Color(red: 0.30, green: 0.65, blue: 0.40)  // forest, lifted
        case "health":                return Color(red: 0.55, green: 0.48, blue: 0.95)  // soft violet
        case "science":               return Color(red: 0.10, green: 0.55, blue: 0.95)  // royal blue
        case "crypto", "lifestyle",
             "travel", "food":        return Color(red: 0.92, green: 0.30, blue: 0.32)  // muted red, lifted
        default:                      return Color.primary
        }
    }

    /// Country code → flag emoji. Maps our pipeline's lowercase country
    /// names ("turkiye", "usa", etc.) to ISO 3166-1 alpha-2 then to the
    /// regional indicator unicode scalars.
    fileprivate func flagEmoji(forCountry name: String) -> String? {
        let key = name.lowercased()
        let iso: String
        switch key {
        case "turkiye", "turkey":   iso = "TR"
        case "usa", "us",
             "united states":       iso = "US"
        case "uk", "britain",
             "united kingdom":      iso = "GB"
        case "germany":             iso = "DE"
        case "france":              iso = "FR"
        case "italy":               iso = "IT"
        case "spain":               iso = "ES"
        case "russia":              iso = "RU"
        case "ukraine":             iso = "UA"
        case "china":               iso = "CN"
        case "japan":               iso = "JP"
        case "south_korea",
             "south korea", "korea":iso = "KR"
        case "india":               iso = "IN"
        case "brazil":              iso = "BR"
        case "canada":               iso = "CA"
        case "australia":           iso = "AU"
        case "mexico":              iso = "MX"
        case "israel":              iso = "IL"
        case "iran":                iso = "IR"
        case "saudi_arabia",
             "saudi arabia":        iso = "SA"
        case "uae", "emirates":     iso = "AE"
        case "egypt":               iso = "EG"
        case "greece":              iso = "GR"
        case "portugal":            iso = "PT"
        case "netherlands":         iso = "NL"
        case "belgium":             iso = "BE"
        case "switzerland":         iso = "CH"
        case "sweden":              iso = "SE"
        case "norway":              iso = "NO"
        case "ireland":             iso = "IE"
        case "argentina":           iso = "AR"
        case "south_africa",
             "south africa":        iso = "ZA"
        default:
            // Two-letter codes pass through ("TR", "US")
            if key.count == 2 { iso = key.uppercased() } else { return nil }
        }
        let base: UInt32 = 127397
        var s = ""
        for u in iso.unicodeScalars {
            if let scalar = Unicode.Scalar(base + u.value) { s.unicodeScalars.append(scalar) }
        }
        return s.isEmpty ? nil : s
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

/// Press-state for topic chips: subtle scale + dim on tap. The
/// pill shape carries the tap affordance — no need for color
/// shouting; the press state is enough.
private struct TopicChipButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.spring(response: 0.18, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

/// Icon-only liquid-glass component switcher. Wrapped in a single
/// `GlassEffectContainer` so all icons share one continuous glass
/// surface. Each icon is its own button — selected one gets a tinted
/// glass capsule, the others are flat / un-tinted.
private struct IconOnlyComponentSwitcher: View {
    let components: [String]
    @Binding var selected: String
    @Namespace private var ns

    var body: some View {
        GlassEffectContainer {
            HStack(spacing: 2) {
                ForEach(components, id: \.self) { component in
                    Button {
                        // Snappy spring (response 0.18) — the previous
                        // quickSpring 0.25 felt sluggish on small pills
                        // because the Liquid Glass `.interactive()`
                        // adds its own physics on top.
                        withAnimation(.spring(response: 0.18, dampingFraction: 0.7)) {
                            selected = component
                        }
                        HapticManager.selection()
                    } label: {
                        Image(systemName: iconFor(component))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(
                                selected == component ? Color.primary : Color.secondary
                            )
                            .frame(width: 32, height: 22)
                            .glassEffect(
                                selected == component
                                    ? .regular
                                    : .identity,
                                in: Capsule()
                            )
                            .glassEffectID(component, in: ns)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(3)
            // Drop .interactive() on the outer pill — it was eating
            // ~80ms of tap latency. Plain glass is enough.
            .glassEffect(.regular, in: Capsule())
        }
    }

    private func iconFor(_ component: String) -> String {
        switch component.lowercased() {
        case "details": return "doc.text"
        case "timeline": return "clock"
        case "graph": return "chart.line.uptrend.xyaxis"
        case "map": return "map"
        default: return "circle"
        }
    }
}
