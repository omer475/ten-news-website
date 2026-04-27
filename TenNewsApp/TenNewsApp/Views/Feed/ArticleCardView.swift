import SwiftUI
import MapKit

// MARK: - Article Card View (Full-screen — image top, content bottom, glass info box)

struct ArticleCardView: View {
    let article: Article
    let accentColor: Color
    @State private var showDetail = false
    @State private var showEventDetail = false
    @State private var dominantColor: Color? = nil
    @State private var dominantBlurColor: Color? = nil
    @State private var contentMode: ContentMode = .bullets
    @State private var infoMode: InfoMode = .details
    @State private var mapExpanded = false
    @State private var timelineExpanded = false
    @State private var graphExpanded = false
    @State private var graphAnimated = false
    @State private var imageIsLight = false
    @State private var showSafari = false
    @State private var showCreatorProfile = false
    @State private var showShareSheet = false

    // Double-tap like animation
    @State private var showHeartAnimation = false

    // Phase 3.2: bidirectional leaf feedback action sheet (long-press gesture).
    @State private var showNotInterestedSheet = false
    @State private var notInterestedConfirmation: String? = nil

    // Multi-page carousel
    @State private var currentPage: Int = 0

    // Engagement tracking (exit event only — engagement signals sent by FeedViewModel)
    @State private var viewStartTime: Date?
    private let analytics = AnalyticsService()

    /// Total page count for this article (1 if no pages array)
    private var pageCount: Int {
        guard let pages = article.pages, pages.count > 1 else { return 1 }
        return pages.count
    }

    /// Whether this is a multi-page carousel article
    private var isMultiPage: Bool { pageCount > 1 }

    /// Current page's title — empty if the page has no title (don't fall back to page 1's title)
    private var currentPageTitle: String {
        guard let pages = article.pages, currentPage < pages.count else {
            return article.displayTitle
        }
        // Page 0 with no title: use the article's main title
        // Other pages with no title: leave empty
        if currentPage == 0 {
            return pages[currentPage].title ?? article.displayTitle
        }
        return pages[currentPage].title ?? ""
    }

    /// Current page's bullets
    private var currentPageBullets: [String] {
        guard let pages = article.pages, currentPage < pages.count,
              let bullets = pages[currentPage].bullets, !bullets.isEmpty else {
            return article.displayBullets
        }
        return bullets
    }

    /// Current page's image URL (falls back to first page's / article's image)
    private var currentPageImage: URL? {
        if let pages = article.pages, currentPage < pages.count,
           let imgStr = pages[currentPage].imageUrl, let url = URL(string: imgStr) {
            return url
        }
        return article.displayImage
    }

    private var effectiveColor: Color { dominantColor ?? accentColor }
    private var overlayIconColor: Color { imageIsLight ? Color(white: 0.15) : .white }
    private var effectiveBlurColor: Color { dominantBlurColor ?? accentColor.opacity(0.9) }

    private var glassTint: Color { .black.opacity(0.15) }

    private let padding: CGFloat = 20
    private let imageRatio: CGFloat = 0.42

    /// Device screen corner radius based on device model
    private var screenCornerRadius: CGFloat {
        let hasRoundedCorners = UIScreen.main.bounds.height >= 812 // iPhone X and later
        return hasRoundedCorners ? 55 : 0
    }

    enum ContentMode: String, CaseIterable { case bullets, fiveW }
    enum InfoMode: String, CaseIterable, Hashable {
        case details, graph, map, timeline, scorecard
        var label: String {
            switch self {
            case .details: "Detail"
            case .graph: "Stats"
            case .map: "Map"
            case .timeline: "Time"
            case .scorecard: "Score"
            }
        }
        var icon: String {
            switch self {
            case .details: "square.grid.2x2"
            case .graph: "chart.bar.fill"
            case .map: "map.fill"
            case .timeline: "clock.fill"
            case .scorecard: "sportscourt.fill"
            }
        }
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width

            ZStack {
                // Background
                effectiveBlurColor.ignoresSafeArea()

                // Main flow layout
                VStack(alignment: .leading, spacing: 0) {
                    // IMAGE — flexible height, shrinks when content is long
                    GeometryReader { imgGeo in
                        if let imageUrl = currentPageImage {
                            AsyncCachedImage(url: imageUrl, contentMode: .fill, onLoaded: { img in
                                extractDominantColor(from: imageUrl, loadedImage: img)
                            })
                                .frame(width: imgGeo.size.width, height: imgGeo.size.height)
                                .clipped()
                        } else {
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            accentColor.opacity(0.4),
                                            accentColor.opacity(0.15),
                                            Color(white: 0.08)
                                        ],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .overlay(alignment: .topLeading) {
                                    Text((article.category ?? "News").uppercased())
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(.white.opacity(0.25))
                                        .tracking(3)
                                        .padding(.top, imgGeo.size.height * 0.45)
                                        .padding(.leading, 20)
                                }
                                .onAppear {
                                    dominantColor = accentColor
                                    dominantBlurColor = Color(white: 0.08)
                                    imageIsLight = false
                                }
                        }
                    }
                    .overlay(alignment: .bottom) {
                        // Blur gradient at bottom of image — overlay so it doesn't inflate layout
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    stops: [
                                        .init(color: effectiveBlurColor.opacity(0.0), location: 0.0),
                                        .init(color: effectiveBlurColor.opacity(0.15), location: 0.10),
                                        .init(color: effectiveBlurColor.opacity(0.40), location: 0.25),
                                        .init(color: effectiveBlurColor.opacity(0.65), location: 0.40),
                                        .init(color: effectiveBlurColor.opacity(0.85), location: 0.55),
                                        .init(color: effectiveBlurColor.opacity(0.95), location: 0.70),
                                        .init(color: effectiveBlurColor, location: 0.85),
                                    ],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .frame(height: 200)
                            .allowsHitTesting(false)
                    }
                    .frame(minHeight: geo.size.height * 0.08)

                    // TITLE — flows naturally, overlaps into blur gradient
                    VStack(alignment: .leading, spacing: 4) {
                        TimeAgoText(article.publishedAt ?? article.createdAt, color: .white.opacity(0.5))
                        if !currentPageTitle.isEmpty {
                            highlightedTitle(currentPageTitle)
                                .padding(.trailing, 36)
                        }
                    }
                    .padding(.horizontal, padding)
                    .padding(.top, -80)

                    // FIXED GAP title → bullets (always constant)
                    Spacer().frame(height: 22)

                    // BULLETS — natural height, fixed spacing
                    let bullets = currentPageBullets
                    let hasInfoBox = !article.availableInfoModes.isEmpty
                    let maxBullets = hasInfoBox ? 3 : 4
                    if !bullets.isEmpty {
                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(Array(bullets.prefix(maxBullets).enumerated()), id: \.offset) { _, bullet in
                                HStack(alignment: .top, spacing: 12) {
                                    Circle()
                                        .fill(effectiveColor)
                                        .frame(width: 5, height: 5)
                                        .padding(.top, 9)
                                    highlightedBullet(bullet)
                                        .font(.system(size: 17, weight: .regular, design: .default))
                                        .foregroundStyle(.white.opacity(0.75))
                                        .lineSpacing(5)
                                        .fixedSize(horizontal: false, vertical: true)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                        .padding(.leading, padding)
                        .padding(.trailing, 55)
                        .layoutPriority(1)
                    }

                    // BOTTOM PADDING — match title→bullet gap (22pt) above tab bar when no info box
                    Spacer().frame(height: hasInfoBox ? (85 + 16 + 80) : 93)
                }

                // Double-tap like — behind buttons so they get hit-test priority.
                // Phase 3.2: long-press opens bidirectional leaf-feedback sheet.
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture(count: 2) {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            LikeManager.shared.like(article)
                            showHeartAnimation = true
                        }
                        HapticManager.medium()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                            withAnimation(.easeOut(duration: 0.3)) {
                                showHeartAnimation = false
                            }
                        }
                    }
                    .onLongPressGesture(minimumDuration: 0.6) {
                        HapticManager.medium()
                        showNotInterestedSheet = true
                    }

                // Floating badges on image (top-right)
                floatingOverlays

                // INFO BOX — only show if article has data
                if !article.availableInfoModes.isEmpty {
                    VStack {
                        Spacer()
                        infoBoxWithModeSwitcher(maxExpandedHeight: w - padding * 2)
                            .environment(\.colorScheme, .dark)
                            .padding(.horizontal, padding)
                            .padding(.bottom, 80)
                    }
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipped()
            // Multi-page horizontal swipe gesture
            .gesture(isMultiPage ? DragGesture(minimumDistance: 30, coordinateSpace: .local)
                .onEnded { value in
                    if value.translation.width < -50 && currentPage < pageCount - 1 {
                        withAnimation(.easeInOut(duration: 0.25)) { currentPage += 1 }
                    } else if value.translation.width > 50 && currentPage > 0 {
                        withAnimation(.easeInOut(duration: 0.25)) { currentPage -= 1 }
                    }
                } : nil)
            // Page indicator dots
            .overlay(alignment: .bottom) {
                if isMultiPage {
                    HStack(spacing: 6) {
                        ForEach(0..<pageCount, id: \.self) { i in
                            Circle()
                                .fill(i == currentPage ? .white : .white.opacity(0.35))
                                .frame(width: i == currentPage ? 8 : 6, height: i == currentPage ? 8 : 6)
                                .animation(.easeInOut(duration: 0.2), value: currentPage)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                    .background(.black.opacity(0.3), in: Capsule())
                    .padding(.bottom, 12)
                }
            }
            .overlay {
                // Double-tap heart animation
                if showHeartAnimation {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 80, weight: .bold))
                        .foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.3), radius: 10, y: 4)
                        .transition(.scale(scale: 0.3).combined(with: .opacity))
                        .allowsHitTesting(false)
                }
            }
        }
        .ignoresSafeArea()
        .onAppear {
            // Set initial info mode to first component from API order
            if let first = article.availableInfoModes.first {
                infoMode = first
            }
            startEngagementTracking()
        }
        .onDisappear {
            stopEngagementTracking()
        }
        .fullScreenCover(isPresented: $showDetail) {
            ArticleDetailView(articleId: article.id, initialArticle: article)
        }
        .sheet(isPresented: $showSafari) {
            if let urlString = article.url, let url = URL(string: urlString) {
                SafariView(url: url)
                    .ignoresSafeArea()
            }
        }
        .fullScreenCover(isPresented: $showCreatorProfile) {
            let creator = SampleCreators.find(bySource: article.source ?? "Unknown")
            CreatorProfileView(
                creator: creator,
                articles: [],
                onDismiss: { showCreatorProfile = false },
                publisherId: article.authorId
            )
        }
        .sheet(isPresented: $showShareSheet) {
            ShareArticleSheet(article: article)
        }
        .fullScreenCover(isPresented: $showEventDetail) {
            if let event = article.worldEvent {
                NavigationStack {
                    EventDetailView(event: WorldEvent(
                        id: event.id,
                        name: event.name,
                        slug: event.slug,
                        imageUrl: nil,
                        coverImageUrl: nil,
                        blurColor: nil,
                        importance: nil,
                        status: "active",
                        lastArticleAt: nil,
                        createdAt: nil,
                        background: nil,
                        newUpdates: nil,
                        countries: nil,
                        topics: nil
                    ))
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Close") { showEventDetail = false }
                        }
                    }
                }
            }
        }
        // Phase 3.2: bidirectional leaf-feedback sheet (long-press). Custom
        // iOS-native-style bottom sheet replaces the generic confirmationDialog.
        .sheet(isPresented: $showNotInterestedSheet) {
            LeafFeedbackSheet(
                onMoreLikeThis: {
                    HapticManager.medium()
                    showNotInterestedSheet = false
                    Task {
                        try? await analytics.track(
                            event: "article_more_like_this",
                            articleId: Int(article.id.stringValue),
                            category: article.category
                        )
                    }
                    showLeafFeedbackToast("We'll show more like this.")
                },
                onNotInterested: {
                    HapticManager.medium()
                    showNotInterestedSheet = false
                    Task {
                        try? await analytics.track(
                            event: "article_not_interested",
                            articleId: Int(article.id.stringValue),
                            category: article.category
                        )
                    }
                    showLeafFeedbackToast("We'll show fewer like this.")
                },
                onCancel: { showNotInterestedSheet = false }
            )
            .presentationDetents([.height(300)])
            .presentationDragIndicator(.visible)
            .presentationBackground(Theme.Colors.backgroundPrimary)
            .presentationCornerRadius(24)
        }
        .overlay(alignment: .top) {
            if let message = notInterestedConfirmation {
                Text(message)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.black.opacity(0.75))
                    .clipShape(Capsule())
                    .padding(.top, 60)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    // MARK: - Hero Image

    @ViewBuilder
    private func heroImage(width: CGFloat, height: CGFloat) -> some View {
        if let imageUrl = article.displayImage {
            AsyncCachedImage(url: imageUrl, contentMode: .fill)
                .frame(width: width, height: height)
                .clipped()
                .onAppear { extractDominantColor(from: imageUrl) }
        } else {
            // No image — dark editorial gradient
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [
                            accentColor.opacity(0.4),
                            accentColor.opacity(0.15),
                            Color(white: 0.08)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: width, height: height)
                .overlay(alignment: .topLeading) {
                    // Subtle category label
                    Text((article.category ?? "News").uppercased())
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white.opacity(0.25))
                        .tracking(3)
                        .padding(.top, height * 0.45)
                        .padding(.leading, 20)
                }
                .onAppear {
                    // Set dark tones for no-image cards
                    dominantColor = accentColor
                    dominantBlurColor = Color(white: 0.08)
                    imageIsLight = false
                }
        }
    }

    // MARK: - Blur Bridge (image → content transition using dominant color)

    private func blurBridge(width: CGFloat, imageHeight: CGFloat) -> some View {
        VStack(spacing: 0) {
            Spacer().frame(height: imageHeight * 0.50)

            Rectangle()
                .fill(
                    LinearGradient(
                        stops: [
                            .init(color: effectiveBlurColor.opacity(0.0), location: 0.0),
                            .init(color: effectiveBlurColor.opacity(0.15), location: 0.10),
                            .init(color: effectiveBlurColor.opacity(0.40), location: 0.25),
                            .init(color: effectiveBlurColor.opacity(0.65), location: 0.40),
                            .init(color: effectiveBlurColor.opacity(0.85), location: 0.55),
                            .init(color: effectiveBlurColor.opacity(0.95), location: 0.70),
                            .init(color: effectiveBlurColor, location: 0.85),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(height: imageHeight * 0.50 + 80)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }

    // MARK: - Title Overlay (white text on image, stays above toolbar)

    private func titleOverlay(width: CGFloat, imageHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Spacer()
            sourcePill
            highlightedTitle(currentPageTitle)
        }
        .padding(.horizontal, padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: imageHeight + 34)
    }

    // MARK: - Source Pill

    private var sourcePill: some View {
        Button {
            if article.url != nil {
                showSafari = true
                Task {
                    try? await analytics.track(
                        event: "source_clicked",
                        articleId: Int(article.id.stringValue),
                        category: article.category,
                        source: article.source
                    )
                }
            }
        } label: {
            HStack(spacing: 6) {
                if let source = article.source {
                    Text(String(source.prefix(1)).uppercased())
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(.white)
                        .frame(width: 18, height: 18)
                        .background(effectiveColor)
                        .clipShape(RoundedRectangle(cornerRadius: 5))

                    Text(source)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                }

                Circle()
                    .fill(.white.opacity(0.25))
                    .frame(width: 3, height: 3)

                TimeAgoText(article.publishedAt ?? article.createdAt, color: .white.opacity(0.45))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.white.opacity(0.06))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func highlightedTitle(_ text: String) -> some View {
        text.coloredTitle(
            size: 28,
            weight: .bold,
            baseColor: .white,
            highlightColor: effectiveColor
        )
        .lineSpacing(2)
        .tracking(-0.8)
        .shadow(color: .black.opacity(0.35), radius: 8, y: 2)
    }

    // MARK: - Content Area (below image — clean background)

    private func contentArea(width: CGFloat, height: CGFloat, imageHeight: CGFloat) -> some View {
        let contentTop = imageHeight + 38
        let infoBoxBottom: CGFloat = 80 + 85
        let availableForBullets = height - contentTop - 8 - infoBoxBottom - 8

        return VStack(alignment: .leading, spacing: 0) {
            Spacer().frame(height: contentTop)

            // Content — bullets
            bulletsList(availableHeight: availableForBullets)
                .padding(.top, 0)
                .padding(.leading, padding)
                .padding(.trailing, 50)

            Spacer(minLength: 0)
        }
    }

    // MARK: - Glass Control Bar

    @Namespace private var controlBarNS
    @Namespace private var infoSegmentNS
    @Namespace private var contentSegmentNS

    private var controlBar: some View {
        GlassEffectContainer {
            HStack(spacing: 0) {
                // Source logo + name + time — tappable to open article
                Button {
                    if article.url != nil {
                        showSafari = true
                        Task {
                            try? await analytics.track(
                                event: "source_clicked",
                                articleId: Int(article.id.stringValue),
                                category: article.category,
                                source: article.source
                            )
                        }
                    }
                } label: {
                    HStack(spacing: 8) {
                        if let source = article.source {
                            Text(String(source.prefix(1)).uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 18, height: 18)
                                .background(effectiveColor.opacity(0.8))
                                .clipShape(RoundedRectangle(cornerRadius: 5))

                            Text(source)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                        }

                        TimeAgoText(article.publishedAt ?? article.createdAt, color: .white)
                    }
                }
                .buttonStyle(.plain)

                Spacer(minLength: 8)

                // Divider
                Rectangle()
                    .fill(.white.opacity(0.12))
                    .frame(width: 1, height: 18)
                    .padding(.horizontal, 6)

                // Content toggle: Bullets | 5W
                contentToggle

                // Divider
                Rectangle()
                    .fill(.white.opacity(0.12))
                    .frame(width: 1, height: 18)
                    .padding(.horizontal, 6)

                // Info box toggle
                infoToggle
            }
            .padding(.horizontal, 10)
            .frame(height: 36)
            .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Glass Segmented Controls

    private var contentToggle: some View {
        Button {
            withAnimation(.easeOut(duration: 0.2)) {
                contentMode = contentMode == .bullets ? .fiveW : .bullets
            }
            HapticManager.selection()
        } label: {
            Text(contentMode == .bullets ? "Bullets" : "5W")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))
                .contentTransition(.numericText())
                .frame(width: 46, height: 22)
                .glassEffect(.regular.tint(effectiveColor.opacity(0.03)).interactive(), in: RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
    }

    private var infoToggle: some View {
        let available = article.availableInfoModes
        return HStack(spacing: 0) {
            ForEach(available, id: \.self) { mode in
                let isActive = infoMode == mode
                Button {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.72)) {
                        infoMode = mode
                        if mode != .map { mapExpanded = false }
                        if mode != .timeline { timelineExpanded = false }
                        if mode != .graph { graphExpanded = false; graphAnimated = false }
                    }
                    HapticManager.selection()
                } label: {
                    Image(systemName: mode.icon)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(isActive ? .white.opacity(0.9) : .white.opacity(0.35))
                        .frame(width: 28, height: 22)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background {
            GeometryReader { geo in
                let pad: CGFloat = 3
                let count = CGFloat(available.count)
                let segW = (geo.size.width - pad * 2) / count
                let idx = available.firstIndex(of: infoMode) ?? 0
                let thumbW = segW - 2
                let thumbH = geo.size.height - pad * 2 - 2
                let thumbX = pad + CGFloat(idx) * segW + 1
                let thumbY = pad + 1
                RoundedRectangle(cornerRadius: 7)
                    .fill(.clear)
                    .frame(width: thumbW, height: thumbH)
                    .glassEffect(.regular.tint(effectiveColor.opacity(0.03)).interactive(), in: RoundedRectangle(cornerRadius: 7))
                    .offset(x: thumbX, y: thumbY)
                    .animation(.spring(response: 0.4, dampingFraction: 0.72), value: infoMode)
            }
        }
        .glassEffect(.regular.tint(effectiveColor.opacity(0.03)).interactive(), in: RoundedRectangle(cornerRadius: 10))
    }

    private func togglePill(_ label: String, isActive: Bool, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(isActive ? .white : .white.opacity(0.4))
                .padding(.horizontal, 8)
                .frame(height: 22)
                .glassEffect(
                    isActive ? .regular.tint(effectiveColor).interactive() : .regular.interactive(),
                    in: RoundedRectangle(cornerRadius: 7)
                )
                .glassEffectID(isActive ? "\(id)-active" : "\(id)-\(label)", in: controlBarNS)
        }
        .buttonStyle(.plain)
    }

    private func iconTogglePill(icon: String, isActive: Bool, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(isActive ? .white : .white.opacity(0.4))
                .frame(width: 28, height: 22)
                .glassEffect(
                    isActive ? .regular.tint(effectiveColor).interactive() : .regular.interactive(),
                    in: RoundedRectangle(cornerRadius: 7)
                )
                .glassEffectID(isActive ? "\(id)-active" : "\(id)-\(icon)", in: controlBarNS)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Bullet Points

    @ViewBuilder
    private func bulletsList(availableHeight: CGFloat) -> some View {
        let bullets = currentPageBullets

        if !bullets.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(bullets.prefix(4).enumerated()), id: \.offset) { _, bullet in
                    HStack(alignment: .top, spacing: 12) {
                        Circle()
                            .fill(effectiveColor)
                            .frame(width: 5, height: 5)
                            .padding(.top, 9)

                        highlightedBullet(bullet)
                            .font(.system(size: 17, weight: .regular, design: .default))
                            .foregroundStyle(.white.opacity(0.75))
                            .lineSpacing(5)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .frame(maxHeight: availableHeight, alignment: .top)
        } else {
            // Fallback: show summary or detailed text when no bullets available
            let fallbackText = article.displaySummary.isEmpty
                ? (article.detailedText ?? article.contentNews ?? "")
                : article.displaySummary

            if !fallbackText.isEmpty {
                ScrollView(.vertical, showsIndicators: false) {
                    Text(fallbackText)
                        .font(.system(size: 16, weight: .regular))
                        .foregroundStyle(.white.opacity(0.75))
                        .lineSpacing(6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(height: availableHeight)
            }
        }
    }

    private func highlightedBullet(_ text: String) -> some View {
        let boldColor = Color.white.opacity(0.95)
        let parts = text.components(separatedBy: "**")
        var views: [Text] = []
        for (i, part) in parts.enumerated() {
            if part.isEmpty { continue }
            if i % 2 == 1 {
                views.append(Text(part).fontWeight(.semibold).foregroundColor(boldColor))
            } else {
                views.append(Text(part))
            }
        }
        return views.reduce(Text("")) { $0 + $1 }
    }

    // MARK: - 5W View

    private struct FiveWItem: Identifiable {
        let id: String
        let label: String
        let value: String
        let icon: String
    }

    private func buildFiveWItems() -> [FiveWItem] {
        guard let fw = article.fiveWs else { return [] }
        var items: [FiveWItem] = []
        if let v = fw.who, !v.isEmpty { items.append(FiveWItem(id: "who", label: "WHO", value: v, icon: "person.fill")) }
        if let v = fw.what, !v.isEmpty { items.append(FiveWItem(id: "what", label: "WHAT", value: v, icon: "doc.text.fill")) }
        if let v = fw.when, !v.isEmpty { items.append(FiveWItem(id: "when", label: "WHEN", value: v, icon: "clock.fill")) }
        if let v = fw.where_, !v.isEmpty { items.append(FiveWItem(id: "where", label: "WHERE", value: v, icon: "mappin.circle.fill")) }
        if let v = fw.why, !v.isEmpty { items.append(FiveWItem(id: "why", label: "WHY", value: v, icon: "questionmark.circle.fill")) }
        return items
    }

    @ViewBuilder
    private func fiveWsList(availableHeight: CGFloat) -> some View {
        let items = buildFiveWItems()

        if !items.isEmpty {
            HStack(alignment: .top, spacing: 0) {
                // Left: timeline spine
                VStack(spacing: 0) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                        VStack(spacing: 0) {
                            // Icon circle
                            ZStack {
                                Circle()
                                    .fill(effectiveColor.opacity(idx == 0 ? 0.2 : 0.1))
                                    .frame(width: 30, height: 30)

                                Image(systemName: item.icon)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(effectiveColor.opacity(idx == 0 ? 1.0 : 0.6))
                            }

                            // Connecting line
                            if idx < items.count - 1 {
                                Rectangle()
                                    .fill(effectiveColor.opacity(0.12))
                                    .frame(width: 1.5)
                                    .frame(maxHeight: .infinity)
                            }
                        }
                        .frame(maxHeight: .infinity)
                    }
                }
                .frame(width: 30)
                .padding(.trailing, 14)

                // Right: content
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { _, item in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.label)
                                .font(.system(size: 9, weight: .heavy))
                                .foregroundStyle(effectiveColor.opacity(0.7))
                                .tracking(1.5)

                            highlightedFiveW(item.value)
                                .font(.system(size: 14, weight: .regular))
                                .foregroundStyle(.white.opacity(0.85))
                                .lineSpacing(2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.top, 4)
                        .frame(maxHeight: .infinity, alignment: .top)
                    }
                }
            }
            .frame(height: availableHeight)
        } else {
            VStack {
                Spacer()
                Text("5W data not available")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.white.opacity(0.35))
                Spacer()
            }
            .frame(height: availableHeight)
        }
    }

    private func highlightedFiveW(_ text: String) -> some View {
        let parts = text.components(separatedBy: "**")
        var views: [Text] = []
        for (i, part) in parts.enumerated() {
            if part.isEmpty { continue }
            if i % 2 == 1 {
                views.append(Text(part).fontWeight(.semibold).foregroundColor(.white.opacity(0.95)))
            } else {
                views.append(Text(part))
            }
        }
        return views.reduce(Text("")) { $0 + $1 }
    }

    // MARK: - Info Box with Mode Switcher

    @ViewBuilder
    private func infoBoxWithModeSwitcher(maxExpandedHeight: CGFloat) -> some View {
        let modes = article.availableInfoModes

        HStack(spacing: 8) {
            infoBox(maxExpandedHeight: maxExpandedHeight)
                .contentShape(Rectangle())
                .onTapGesture {
                    guard modes.count > 1 else { return }
                    let currentIdx = modes.firstIndex(of: infoMode) ?? 0
                    let nextIdx = (currentIdx + 1) % modes.count
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                        infoMode = modes[nextIdx]
                        if modes[nextIdx] != .map { mapExpanded = false }
                        if modes[nextIdx] != .timeline { timelineExpanded = false }
                        if modes[nextIdx] != .graph { graphExpanded = false; graphAnimated = false }
                    }
                    HapticManager.selection()
                }

            if modes.count > 1 {
                GlassEffectContainer {
                    VStack(spacing: 0) {
                        ForEach(modes, id: \.self) { mode in
                            Button {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                                    infoMode = mode
                                    if mode != .map { mapExpanded = false }
                                    if mode != .timeline { timelineExpanded = false }
                                    if mode != .graph { graphExpanded = false; graphAnimated = false }
                                }
                                HapticManager.selection()
                            } label: {
                                Image(systemName: mode.icon)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(infoMode == mode ? effectiveColor : .white.opacity(0.35))
                                    .frame(width: 28, height: 28)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                    .glassEffect(.regular.tint(glassTint), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
        }
    }

    @ViewBuilder
    private func infoBox(maxExpandedHeight: CGFloat) -> some View {
        switch infoMode {
        case .details:
            if let details = article.details, !details.isEmpty {
                detailsInfoBox(details)
            } else if let graph = article.graph ?? article.graphData, let points = graph.data, !points.isEmpty {
                compactGraph(points: points, graph: graph, expandedHeight: maxExpandedHeight)
            } else {
                summaryInfoBox
            }
        case .graph:
            if let graph = article.graph ?? article.graphData, let points = graph.data, !points.isEmpty {
                compactGraph(points: points, graph: graph, expandedHeight: maxExpandedHeight)
            }
        case .map:
            if let mapData = article.map ?? article.mapData, mapData.hasMapContent {
                compactMap(mapData: mapData, expandedHeight: maxExpandedHeight)
            }
        case .timeline:
            if let timeline = article.timeline, !timeline.isEmpty {
                compactTimeline(entries: timeline, expandedHeight: maxExpandedHeight)
            }
        case .scorecard:
            if let sc = article.scorecard {
                scorecardView(sc, expandedHeight: maxExpandedHeight)
            }
        }
    }

    /// Fallback info box when no details/graph data available
    private var summaryInfoBox: some View {
        GlassEffectContainer {
            HStack(spacing: 12) {
                Image(systemName: "newspaper.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(effectiveColor)

                VStack(alignment: .leading, spacing: 2) {
                    Text(article.source ?? "News")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.8))
                    Text(article.category ?? "General")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.4))
                }

                Spacer()

                if let score = article.finalScore?.value ?? article.baseScore?.value {
                    VStack(spacing: 2) {
                        Text("SCORE")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(.white.opacity(0.4))
                            .tracking(0.5)
                        Text("\(Int(score))")
                            .font(.system(size: 20, weight: .heavy))
                            .foregroundStyle(effectiveColor)
                    }
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 85)
            .glassEffect(.regular.tint(glassTint).interactive(), in: RoundedRectangle(cornerRadius: 22))
        }
    }

    /// Parses **bold** markers from value string → (mainValue, subtitle)
    private func parseValue(_ text: String) -> (main: String, subtitle: String) {
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

    // Info box views — each is a duplicate of the controlBar structure
    private func detailsInfoBox(_ details: [DetailItem]) -> some View {
        let displayItems = Array(details.prefix(3))
        return GlassEffectContainer {
            HStack(spacing: 0) {
                ForEach(Array(displayItems.enumerated()), id: \.offset) { idx, item in
                    let parsed = parseValue(item.displayValue)

                    VStack(spacing: 4) {
                        Text(item.displayLabel.uppercased())
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(.white.opacity(0.5))
                            .tracking(0.5)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)

                        Text(parsed.main)
                            .font(.system(size: 22, weight: .heavy))
                            .foregroundStyle(effectiveColor)
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)

                        if !parsed.subtitle.isEmpty {
                            Text(parsed.subtitle)
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(.white.opacity(0.4))
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)

                    if idx < displayItems.count - 1 {
                        Rectangle()
                            .fill(.white.opacity(0.12))
                            .frame(width: 1, height: 40)
                    }
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 85)
            .glassEffect(.regular.tint(glassTint).interactive(), in: RoundedRectangle(cornerRadius: 22))
        }
    }

    private func compactGraph(points: [GraphPoint], graph: GraphData, expandedHeight: CGFloat) -> some View {
        let maxVal = points.map(\.displayValue).max() ?? 1
        let minVal = points.map(\.displayValue).min() ?? 0
        let maxIdx = points.enumerated().max(by: { $0.element.displayValue < $1.element.displayValue })?.offset ?? 0

        return GlassEffectContainer {
            VStack(spacing: 0) {
                if graphExpanded {
                    // EXPANDED: full chart with grid lines, values, and highlighted max
                    VStack(alignment: .leading, spacing: 0) {
                        // Header: title + max value callout
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 2) {
                                if let title = graph.title, !title.isEmpty {
                                    Text(title.uppercased())
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(.white.opacity(0.4))
                                        .tracking(0.8)
                                }
                                if let yLabel = graph.yLabel, !yLabel.isEmpty {
                                    Text(yLabel)
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundStyle(.white.opacity(0.3))
                                }
                            }

                            Spacer()

                            // Max value highlight
                            VStack(alignment: .trailing, spacing: 1) {
                                Text(formatStatValue(maxVal))
                                    .font(.system(size: 22, weight: .heavy))
                                    .foregroundStyle(effectiveColor)
                                Text("peak")
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.35))
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 14)

                        // Chart area with horizontal grid lines
                        ZStack(alignment: .bottom) {
                            // Grid lines
                            VStack(spacing: 0) {
                                ForEach(0..<4, id: \.self) { _ in
                                    Rectangle()
                                        .fill(.white.opacity(0.05))
                                        .frame(height: 1)
                                        .frame(maxWidth: .infinity)
                                    Spacer(minLength: 0)
                                }
                            }
                            .padding(.horizontal, 16)

                            // Bars
                            HStack(alignment: .bottom, spacing: points.count > 8 ? 3 : 5) {
                                ForEach(Array(points.enumerated()), id: \.offset) { idx, point in
                                    let ratio = maxVal > 0 ? CGFloat(point.displayValue / maxVal) : 0
                                    let isMax = idx == maxIdx
                                    let barH = max(expandedHeight, 200) - 100

                                    VStack(spacing: 4) {
                                        Spacer(minLength: 0)

                                        // Value above bar
                                        Text(formatStatValue(point.displayValue))
                                            .font(.system(size: 8, weight: .bold))
                                            .foregroundStyle(isMax ? effectiveColor : .white.opacity(0.5))
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.5)

                                        // Bar
                                        RoundedRectangle(cornerRadius: 4)
                                            .fill(
                                                LinearGradient(
                                                    colors: isMax
                                                        ? [effectiveColor, effectiveColor.opacity(0.6)]
                                                        : [effectiveColor.opacity(0.35), effectiveColor.opacity(0.15)],
                                                    startPoint: .top,
                                                    endPoint: .bottom
                                                )
                                            )
                                            .frame(maxWidth: .infinity)
                                            .frame(height: graphAnimated ? max(ratio * barH, 4) : 4)

                                        // Label
                                        Text(point.displayLabel)
                                            .font(.system(size: 7, weight: isMax ? .bold : .medium))
                                            .foregroundStyle(isMax ? effectiveColor.opacity(0.8) : .white.opacity(0.4))
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.5)
                                            .frame(maxWidth: .infinity)
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                        .padding(.top, 8)
                        .padding(.bottom, 14)
                    }
                    .frame(height: max(expandedHeight, 200))
                } else {
                    // COLLAPSED: sparkline-style preview with title and value
                    HStack(spacing: 0) {
                        // Left: title + max value
                        VStack(alignment: .leading, spacing: 4) {
                            if let title = graph.title, !title.isEmpty {
                                Text(title.uppercased())
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white.opacity(0.4))
                                    .tracking(0.8)
                                    .lineLimit(1)
                            }
                            Text(formatStatValue(maxVal))
                                .font(.system(size: 24, weight: .heavy))
                                .foregroundStyle(effectiveColor)
                            if let yLabel = graph.yLabel, !yLabel.isEmpty {
                                Text(yLabel)
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.3))
                            }
                        }
                        .frame(width: 80, alignment: .leading)
                        .padding(.leading, 16)

                        // Right: mini bar chart
                        HStack(alignment: .bottom, spacing: points.count > 8 ? 2 : 3) {
                            ForEach(Array(points.enumerated()), id: \.offset) { idx, point in
                                let ratio = maxVal > 0 ? CGFloat(point.displayValue / maxVal) : 0
                                let isMax = idx == maxIdx

                                RoundedRectangle(cornerRadius: 3)
                                    .fill(
                                        isMax ? effectiveColor : effectiveColor.opacity(0.2 + ratio * 0.3)
                                    )
                                    .frame(maxWidth: .infinity)
                                    .frame(height: max(ratio * 45, 3))
                            }
                        }
                        .padding(.trailing, 16)
                        .padding(.vertical, 16)
                    }
                    .frame(height: 85)
                }
            }
            .glassEffect(.regular.tint(glassTint).interactive(), in: RoundedRectangle(cornerRadius: 22))
            .overlay(alignment: .topTrailing) {
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        graphExpanded.toggle()
                    }
                    if graphExpanded {
                        withAnimation(.easeOut(duration: 0.6).delay(0.15)) {
                            graphAnimated = true
                        }
                    } else {
                        graphAnimated = false
                    }
                    HapticManager.light()
                } label: {
                    Image(systemName: graphExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 30, height: 30)
                        .glassEffect(.regular.tint(glassTint).interactive(), in: Circle())
                }
                .padding(8)
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: graphExpanded)
        }
    }

    private func compactMap(mapData: MapData, expandedHeight: CGFloat) -> some View {
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
        let mapHeight: CGFloat = mapExpanded ? max(expandedHeight, 200) : 85

        return Map(initialPosition: .region(region), interactionModes: mapExpanded ? [.zoom, .pan] : []) {
            ForEach(Array(locations.enumerated()), id: \.offset) { _, location in
                Annotation(
                    "",
                    coordinate: CLLocationCoordinate2D(
                        latitude: location.latitude,
                        longitude: location.longitude
                    )
                ) {
                    VStack(spacing: 2) {
                        Circle()
                            .fill(effectiveColor)
                            .frame(width: 10, height: 10)
                            .overlay(
                                Circle()
                                    .stroke(.white, lineWidth: 2)
                            )
                            .shadow(color: .black.opacity(0.3), radius: 3, y: 1)
                        if let name = location.name, !name.isEmpty {
                            Text(name)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.ultraThinMaterial)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
        .frame(height: mapHeight)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(alignment: .topTrailing) {
            Button {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    mapExpanded.toggle()
                }
                HapticManager.light()
            } label: {
                Image(systemName: mapExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }
            .padding(8)
        }
        .overlay(alignment: .bottomLeading) {
            HStack(spacing: 5) {
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(effectiveColor)
                Text(locationDetail.isEmpty ? locationName : locationDetail)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
            .padding(8)
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: mapExpanded)
    }

    private func compactTimeline(entries: [TimelineEntry], expandedHeight: CGFloat) -> some View {
        let maxH = max(expandedHeight, 200)
        // Calculate height based on content: ~80pt per entry + 28pt padding, capped at max
        let contentHeight = min(CGFloat(entries.count) * 80 + 28, maxH)

        return GlassEffectContainer {
            VStack(spacing: 0) {
                if timelineExpanded {
                    // Expanded: sized to content height
                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(entries.enumerated()), id: \.offset) { idx, entry in
                                HStack(alignment: .top, spacing: 12) {
                                    VStack(spacing: 0) {
                                        Circle()
                                            .fill(idx == 0 ? effectiveColor : effectiveColor.opacity(0.5))
                                            .frame(width: 8, height: 8)
                                            .overlay(
                                                Circle()
                                                    .stroke(effectiveColor.opacity(0.3), lineWidth: idx == 0 ? 3 : 0)
                                                    .frame(width: 14, height: 14)
                                            )
                                        if idx < entries.count - 1 {
                                            Rectangle()
                                                .fill(effectiveColor.opacity(0.15))
                                                .frame(width: 1.5)
                                                .frame(minHeight: 28)
                                        }
                                    }
                                    .padding(.top, 2)

                                    VStack(alignment: .leading, spacing: 3) {
                                        if let date = entry.date, !date.isEmpty {
                                            Text(date)
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundStyle(effectiveColor)
                                                .tracking(0.3)
                                        }
                                        Text(entry.displayText)
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundStyle(.white.opacity(0.8))
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
                    // Collapsed: compact 3-entry view — fixed 85px
                    let displayEntries = Array(entries.prefix(3))
                    HStack(alignment: .top, spacing: 0) {
                        VStack(spacing: 0) {
                            ForEach(Array(displayEntries.enumerated()), id: \.offset) { idx, _ in
                                Circle()
                                    .fill(idx == 0 ? effectiveColor : effectiveColor.opacity(0.35))
                                    .frame(width: 5, height: 5)
                                if idx < displayEntries.count - 1 {
                                    Rectangle()
                                        .fill(effectiveColor.opacity(0.15))
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
                                            .foregroundStyle(effectiveColor)
                                            .frame(width: 58, alignment: .leading)
                                    }
                                    Text(entry.displayText)
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundStyle(.white.opacity(0.8))
                                        .lineLimit(1)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .frame(maxHeight: .infinity)
                            }
                        }
                        .padding(.leading, 10)
                        .padding(.trailing, 40)
                    }
                    .frame(height: 85)
                }
            }
            .glassEffect(.regular.tint(glassTint).interactive(), in: RoundedRectangle(cornerRadius: 22))
            .overlay(alignment: .topTrailing) {
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        timelineExpanded.toggle()
                    }
                    HapticManager.light()
                } label: {
                    Image(systemName: timelineExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 30, height: 30)
                        .glassEffect(.regular.tint(glassTint).interactive(), in: Circle())
                }
                .padding(8)
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: timelineExpanded)
        }
    }

    // MARK: - Scorecard View

    @State private var scorecardExpanded = false

    private func scorecardView(_ sc: Scorecard, expandedHeight: CGFloat) -> some View {
        let home = sc.homeTeam ?? "Home"
        let away = sc.awayTeam ?? "Away"
        let homeScore = sc.homeScore ?? 0
        let awayScore = sc.awayScore ?? 0
        let comp = sc.competition ?? ""
        let homeWins = homeScore > awayScore
        let awayWins = awayScore > homeScore

        return GlassEffectContainer {
            VStack(spacing: 0) {
                if scorecardExpanded {
                    // EXPANDED: full match card
                    VStack(spacing: 0) {
                        // Competition header
                        if !comp.isEmpty {
                            Text(comp.uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.white.opacity(0.4))
                                .tracking(1.2)
                                .padding(.top, 14)
                        }

                        // Score line
                        HStack(spacing: 0) {
                            // Home
                            VStack(spacing: 6) {
                                Text(String(home.prefix(3)).uppercased())
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(.white.opacity(0.5))
                                    .tracking(0.8)
                                Text("\(homeScore)")
                                    .font(.system(size: 40, weight: .heavy))
                                    .foregroundStyle(homeWins ? effectiveColor : .white)
                                Text(home)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.7))
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity)

                            // Divider
                            VStack(spacing: 4) {
                                Text("VS")
                                    .font(.system(size: 10, weight: .heavy))
                                    .foregroundStyle(.white.opacity(0.2))
                                    .tracking(1)
                                Rectangle()
                                    .fill(.white.opacity(0.08))
                                    .frame(width: 1, height: 30)
                            }

                            // Away
                            VStack(spacing: 6) {
                                Text(String(away.prefix(3)).uppercased())
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(.white.opacity(0.5))
                                    .tracking(0.8)
                                Text("\(awayScore)")
                                    .font(.system(size: 40, weight: .heavy))
                                    .foregroundStyle(awayWins ? effectiveColor : .white)
                                Text(away)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.7))
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 10)

                        // Scorers
                        if let scorers = sc.scorers, !scorers.isEmpty {
                            let validScorers = scorers.filter { $0.player != nil && $0.player != "Unknown" }
                            if !validScorers.isEmpty {
                                Rectangle()
                                    .fill(.white.opacity(0.06))
                                    .frame(height: 1)
                                    .padding(.horizontal, 20)
                                    .padding(.top, 10)

                                VStack(spacing: 6) {
                                    ForEach(Array(validScorers.prefix(4).enumerated()), id: \.offset) { _, scorer in
                                        HStack(spacing: 8) {
                                            Circle()
                                                .fill(scorer.team == "home" ? effectiveColor : .white.opacity(0.3))
                                                .frame(width: 5, height: 5)
                                            Text(scorer.player ?? "")
                                                .font(.system(size: 12, weight: .semibold))
                                                .foregroundStyle(.white.opacity(0.8))
                                            if let min = scorer.minute, min != "N/A", min != "Unknown" {
                                                Text(min)
                                                    .font(.system(size: 10, weight: .medium))
                                                    .foregroundStyle(.white.opacity(0.4))
                                            }
                                            Spacer()
                                        }
                                    }
                                }
                                .padding(.horizontal, 20)
                                .padding(.top, 8)
                            }
                        }

                        // Standing impact
                        if let impact = sc.standingImpact, !impact.isEmpty {
                            Text(impact)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.white.opacity(0.4))
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
                                .padding(.horizontal, 20)
                                .padding(.top, 8)
                        }

                        Spacer(minLength: 10)
                    }
                    .frame(height: min(expandedHeight, 280))
                } else {
                    // COLLAPSED: compact score display
                    HStack(spacing: 0) {
                        // Home team + score
                        HStack(spacing: 10) {
                            Text(home)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(.white.opacity(0.8))
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                            Text("\(homeScore)")
                                .font(.system(size: 28, weight: .heavy))
                                .foregroundStyle(homeWins ? effectiveColor : .white)
                        }
                        .frame(maxWidth: .infinity)

                        // Separator
                        VStack(spacing: 2) {
                            Text(comp.isEmpty ? "–" : comp)
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(.white.opacity(0.3))
                                .tracking(0.5)
                                .lineLimit(1)
                            Text(":")
                                .font(.system(size: 20, weight: .heavy))
                                .foregroundStyle(.white.opacity(0.2))
                        }
                        .frame(width: 60)

                        // Away team + score
                        HStack(spacing: 10) {
                            Text("\(awayScore)")
                                .font(.system(size: 28, weight: .heavy))
                                .foregroundStyle(awayWins ? effectiveColor : .white)
                            Text(away)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(.white.opacity(0.8))
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 85)
                }
            }
            .glassEffect(.regular.tint(glassTint).interactive(), in: RoundedRectangle(cornerRadius: 22))
            .overlay(alignment: .topTrailing) {
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        scorecardExpanded.toggle()
                    }
                    HapticManager.light()
                } label: {
                    Image(systemName: scorecardExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 30, height: 30)
                        .glassEffect(.regular.tint(glassTint).interactive(), in: Circle())
                }
                .padding(8)
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: scorecardExpanded)
        }
    }

    // MARK: - Floating Overlays

    private var floatingOverlays: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                VStack(spacing: 28) {
                    // Creator profile button (TikTok-style)
                    // Creator avatar + follow badge
                    creatorFollowButton

                    // Like
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            LikeManager.shared.toggle(article)
                        }
                        HapticManager.medium()
                    } label: {
                        VStack(spacing: 2) {
                            Image(systemName: LikeManager.shared.isLiked(article.id) ? "heart.fill" : "heart")
                                .font(.system(size: 24, weight: .medium))
                                .foregroundStyle(LikeManager.shared.isLiked(article.id) ? .red : .white.opacity(0.8))
                                .symbolEffect(.bounce, value: LikeManager.shared.isLiked(article.id))
                            Text("0")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.white.opacity(0.5))
                        }
                    }

                    // Comment (placeholder)
                    VStack(spacing: 2) {
                        Image(systemName: "bubble.right")
                            .font(.system(size: 24, weight: .medium))
                            .foregroundStyle(.white.opacity(0.8))
                        Text("0")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.white.opacity(0.5))
                    }

                    // Bookmark
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            BookmarkManager.shared.toggle(article)
                        }
                        HapticManager.light()
                    } label: {
                        VStack(spacing: 2) {
                            Image(systemName: BookmarkManager.shared.isBookmarked(article.id) ? "bookmark.fill" : "bookmark")
                                .font(.system(size: 24, weight: .medium))
                                .foregroundStyle(BookmarkManager.shared.isBookmarked(article.id) ? .white : .white.opacity(0.8))
                                .symbolEffect(.bounce, value: BookmarkManager.shared.isBookmarked(article.id))
                            Text("0")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.white.opacity(0.5))
                        }
                    }

                    // Share
                    Button {
                        showShareSheet = true
                        HapticManager.light()
                    } label: {
                        VStack(spacing: 2) {
                            Image(systemName: "arrowshape.turn.up.right")
                                .font(.system(size: 24, weight: .medium))
                                .foregroundStyle(.white.opacity(0.8))
                            Text("0")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.white.opacity(0.5))
                        }
                    }
                }
                .padding(.trailing, 18)
            }
            .padding(.bottom, 200)
        }
    }

    private var creatorFollowButton: some View {
        let logoColors: [Color] = [.blue, .purple, .pink, .orange, .teal, .indigo, .mint, .cyan]
        let creatorName = article.authorName ?? article.source ?? ""
        let logoColor = logoColors[abs(creatorName.hashValue) % logoColors.count]
        let following = FollowManager.shared.isFollowing(article.authorId)

        return ZStack(alignment: .bottom) {
            Button {
                showCreatorProfile = true
                HapticManager.light()
            } label: {
                Text(String((creatorName.isEmpty ? "N" : creatorName).prefix(1)).uppercased())
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(logoColor)
                    .clipShape(Circle())
                    .overlay(
                        Circle()
                            .stroke(.white.opacity(0.2), lineWidth: 1.5)
                    )
            }

            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                    FollowManager.shared.toggle(article.authorId, userId: nil)
                }
                HapticManager.medium()
            } label: {
                Image(systemName: following ? "checkmark" : "plus")
                    .font(.system(size: 8, weight: .black))
                    .foregroundStyle(.white)
                    .frame(width: 18, height: 18)
                    .background(following ? .green : .red, in: Circle())
                    .overlay(Circle().stroke(.black, lineWidth: 1.5))
            }
            .offset(y: 8)
        }
    }

    private func eventBadge(_ event: ArticleWorldEvent) -> some View {
        Button {
            showEventDetail = true
            HapticManager.light()
        } label: {
            Text(event.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .tracking(0.2)
                .lineLimit(1)
                .padding(.horizontal, 14)
                .frame(height: 34)
                .frame(maxWidth: 160)
                .glassEffect(.regular.tint(effectiveColor.opacity(0.4)).interactive(), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Dominant Color Extraction (website-matching algorithm)

    /// RGB → HSL conversion (0-360, 0-100, 0-100)
    nonisolated static func rgbToHSL(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> (h: CGFloat, s: CGFloat, l: CGFloat) {
        let maxC = max(r, g, b)
        let minC = min(r, g, b)
        var h: CGFloat = 0
        var s: CGFloat = 0
        let l = (maxC + minC) / 2.0

        if maxC != minC {
            let d = maxC - minC
            s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC)
            if maxC == r {
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6.0
            } else if maxC == g {
                h = ((b - r) / d + 2) / 6.0
            } else {
                h = ((r - g) / d + 4) / 6.0
            }
        }
        return (h * 360, s * 100, l * 100)
    }

    /// HSL → SwiftUI Color (converts HSL to HSB for Color init)
    nonisolated static func colorFromHSL(h: CGFloat, s: CGFloat, l: CGFloat) -> Color {
        let hNorm = h / 360.0
        let sNorm = s / 100.0
        let lNorm = l / 100.0
        // HSL → HSB conversion
        let v = lNorm + sNorm * min(lNorm, 1 - lNorm)
        let sB = v > 0 ? 2.0 * (1.0 - lNorm / v) : 0.0
        return Color(hue: Double(hNorm), saturation: Double(sB), brightness: Double(v))
    }

    /// Cache for extracted colors so we don't recompute on every appear
    nonisolated(unsafe) static let colorCache = NSCache<NSURL, UIColor>()
    nonisolated(unsafe) static let blurColorCache = NSCache<NSURL, UIColor>()
    nonisolated(unsafe) static let lightnessCache = NSCache<NSURL, NSNumber>()

    /// Shared color extraction used by the article page and every card preview
    /// (ExploreArticleCard, SearchResultCard, …). Ensures the blur tint and
    /// highlight color shown on a preview card exactly match what the user will
    /// see when the full article opens — same cache, same algorithm, one source
    /// of truth.
    ///
    /// Returns the accent color, blur color, and a lightness flag used by the
    /// full article view for icon contrast. Results are written to the three
    /// shared NSCaches so the next caller hits cache.
    nonisolated static func extractAndCacheColors(
        url: URL,
        loadedImage: UIImage?
    ) async -> (accent: UIColor, blur: UIColor, isLight: Bool)? {
        // Fast path: everything cached
        if let accent = colorCache.object(forKey: url as NSURL),
           let blur = blurColorCache.object(forKey: url as NSURL),
           let light = lightnessCache.object(forKey: url as NSURL) {
            return (accent, blur, light.boolValue)
        }

        // Acquire a UIImage — provided, from the image cache, or by downloading.
        let uiImage: UIImage
        if let provided = loadedImage {
            uiImage = provided
        } else if let cached = AsyncCachedImage.cache.object(forKey: url as NSURL) {
            uiImage = cached
        } else {
            guard let (data, _) = try? await URLSession.shared.data(from: url),
                  let downloaded = UIImage(data: data) else { return nil }
            AsyncCachedImage.cache.setObject(downloaded, forKey: url as NSURL)
            uiImage = downloaded
        }
        guard let cgImage = uiImage.cgImage else { return nil }

        let sampleW = min(cgImage.width, 80)
        let sampleH = min(cgImage.height, 80)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        var rawData = [UInt8](repeating: 0, count: sampleW * sampleH * 4)

        guard let context = CGContext(
            data: &rawData, width: sampleW, height: sampleH,
            bitsPerComponent: 8, bytesPerRow: sampleW * 4, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: sampleW, height: sampleH))

        struct ColorBucket {
            var count: Int = 0
            var bottomCount: Int = 0
            var positions: Set<String> = []
            var rKey: Int
            var gKey: Int
            var bKey: Int
        }

        var buckets: [String: ColorBucket] = [:]
        let totalPixels = sampleW * sampleH
        let bottomStart = sampleH / 2

        for i in stride(from: 0, to: totalPixels * 4, by: 10 * 4) {
            let r = Int(rawData[i])
            let g = Int(rawData[i + 1])
            let b = Int(rawData[i + 2])
            let a = Int(rawData[i + 3])

            if a < 125 { continue }
            if r > 250 && g > 250 && b > 250 { continue }
            if r < 10 && g < 10 && b < 10 { continue }

            let rK = (r / 15) * 15
            let gK = (g / 15) * 15
            let bK = (b / 15) * 15
            let key = "\(rK),\(gK),\(bK)"

            let pixelIdx = i / 4
            let px = (pixelIdx % sampleW) / 10
            let py = (pixelIdx / sampleW) / 10
            let isBottom = (pixelIdx / sampleW) >= bottomStart

            if buckets[key] == nil {
                buckets[key] = ColorBucket(rKey: rK, gKey: gK, bKey: bK)
            }
            buckets[key]!.count += 1
            if isBottom { buckets[key]!.bottomCount += 1 }
            buckets[key]!.positions.insert("\(px),\(py)")
        }

        guard !buckets.isEmpty else { return nil }

        // --- Accent color ---
        struct ScoredColor {
            let h: CGFloat
            let s: CGFloat
            let l: CGFloat
            let count: Int
            let coverage: Int
            var score: CGFloat = 0
        }

        let maxCount = CGFloat(buckets.values.map { $0.count }.max() ?? 1)
        let maxCoverage = CGFloat(buckets.values.map { $0.positions.count }.max() ?? 1)

        // --- Preferred hue family (feed v11) ---
        //
        // The accent picker (whole image) and blur picker (bottom half)
        // can land on different hue families when the image has a small
        // saturated region in the upper portion (e.g. warm bokeh lights
        // above a desk in a dark navy office). 2026-04-26 21:42 Thomson
        // Reuters card hit this — orange highlight on a navy background.
        //
        // Snapshot the dominant SATURATED hue from the bottom half before
        // accent scoring runs, then bias accent candidates toward that
        // family. Same single-color-family principle Apple Music, Spotify,
        // and TikTok use on auto-tinted card backgrounds.
        let preferredHueFamily: CGFloat? = {
            let scored = buckets.values
                .filter { $0.bottomCount > 0 }
                .map { (b: ColorBucket) -> (h: CGFloat, s: CGFloat, score: CGFloat) in
                    let hsl = rgbToHSL(CGFloat(b.rKey) / 255.0,
                                       CGFloat(b.gKey) / 255.0,
                                       CGFloat(b.bKey) / 255.0)
                    return (hsl.h, hsl.s, CGFloat(b.bottomCount) * (hsl.s / 100.0))
                }
                .filter { $0.s >= 25 }
                .sorted { $0.score > $1.score }
            return scored.first?.h
        }()

        var accentCandidates: [ScoredColor] = buckets.values.compactMap { bucket in
            let r = CGFloat(bucket.rKey) / 255.0
            let g = CGFloat(bucket.gKey) / 255.0
            let b = CGFloat(bucket.bKey) / 255.0
            let hsl = rgbToHSL(r, g, b)
            guard hsl.s >= 35 && hsl.l >= 20 && hsl.l <= 80 else { return nil }
            return ScoredColor(h: hsl.h, s: hsl.s, l: hsl.l, count: bucket.count, coverage: bucket.positions.count)
        }

        if accentCandidates.isEmpty {
            let fallback = buckets.values.max(by: {
                rgbToHSL(CGFloat($0.rKey)/255, CGFloat($0.gKey)/255, CGFloat($0.bKey)/255).s <
                rgbToHSL(CGFloat($1.rKey)/255, CGFloat($1.gKey)/255, CGFloat($1.bKey)/255).s
            })
            if let fb = fallback {
                let hsl = rgbToHSL(CGFloat(fb.rKey)/255, CGFloat(fb.gKey)/255, CGFloat(fb.bKey)/255)
                accentCandidates = [ScoredColor(h: hsl.h, s: hsl.s, l: hsl.l, count: fb.count, coverage: fb.positions.count)]
            }
        }

        guard !accentCandidates.isEmpty else { return nil }

        for i in accentCandidates.indices {
            let normFreq = CGFloat(accentCandidates[i].count) / maxCount
            let normSat = accentCandidates[i].s / 100.0
            let normCov = CGFloat(accentCandidates[i].coverage) / maxCoverage
            var score = normFreq * 0.50 + normSat * 0.30 + normCov * 0.20
            if accentCandidates[i].h >= 200 && accentCandidates[i].h <= 220 && accentCandidates[i].s < 60 { score *= 0.85 }
            if accentCandidates[i].h >= 15 && accentCandidates[i].h <= 50 && accentCandidates[i].s < 65 { score *= 0.7 }

            // Hue-family coupling (feed v11) — boost candidates within ±45°
            // of the bottom-half dominant hue, penalise candidates more
            // than 90° away. Locks accent and blur into the same color
            // family. Wrap-around-aware so reds at h=355 sit next to
            // reds at h=5.
            if let preferredH = preferredHueFamily {
                let raw = abs(accentCandidates[i].h - preferredH)
                let diff = min(raw, 360 - raw)
                if diff <= 45 {
                    score *= 1.3
                } else if diff > 90 {
                    score *= 0.5
                }
            }

            accentCandidates[i].score = score
        }

        accentCandidates.sort { $0.score > $1.score }
        let accentWinner = accentCandidates[0]

        let accentS = min(90.0, accentWinner.s * 1.15)
        let accentL: CGFloat = accentWinner.l <= 40
            ? 55.0 + (accentWinner.l / 40.0) * 10.0
            : 65.0 + ((accentWinner.l - 40.0) / 40.0) * 10.0
        let accentCol = colorFromHSL(
            h: accentWinner.h,
            s: max(65.0, accentS),
            l: max(55.0, min(75.0, accentL))
        )

        // --- Blur color ---
        let bottomBuckets = buckets.values
            .filter { $0.bottomCount > 0 }
            .sorted { $0.bottomCount > $1.bottomCount }

        var bestBlurBucket = bottomBuckets.first ?? buckets.values.max(by: { $0.count < $1.count })!
        var bestBlurScore: CGFloat = -1
        let maxBottomCount = CGFloat(bottomBuckets.first?.bottomCount ?? 1)

        for bucket in bottomBuckets {
            let hsl = rgbToHSL(CGFloat(bucket.rKey) / 255, CGFloat(bucket.gKey) / 255, CGFloat(bucket.bKey) / 255)
            let freq = CGFloat(bucket.bottomCount) / maxBottomCount
            var score = freq * 0.4 + (hsl.s / 100) * 0.45 + (CGFloat(bucket.positions.count) / maxCoverage) * 0.15
            let isMuddyBrown = hsl.h >= 20 && hsl.h <= 55 && hsl.s < 35
            if isMuddyBrown && freq < 0.7 { score *= 0.3 }
            if hsl.s < 15 && hsl.l < 30 { score *= 0.4 }
            if hsl.s >= 40 {
                if (hsl.h >= 180 && hsl.h <= 300) { score *= 1.3 }
                if (hsl.h >= 330 || hsl.h <= 15) { score *= 1.25 }
                if (hsl.h >= 100 && hsl.h <= 170) { score *= 1.2 }
                if (hsl.h >= 40 && hsl.h <= 70) { score *= 1.2 }
                if (hsl.h >= 15 && hsl.h <= 40) { score *= 1.15 }
            }
            if score > bestBlurScore {
                bestBlurScore = score
                bestBlurBucket = bucket
            }
        }

        let blurHSL = rgbToHSL(
            CGFloat(bestBlurBucket.rKey) / 255, CGFloat(bestBlurBucket.gKey) / 255, CGFloat(bestBlurBucket.bKey) / 255
        )

        let sourceH = blurHSL.s >= 15 ? blurHSL.h : accentWinner.h
        let sourceS = blurHSL.s >= 15 ? blurHSL.s : accentWinner.s

        let finalH: CGFloat
        let finalS: CGFloat
        let finalL: CGFloat

        if blurHSL.s < 10 && accentWinner.s < 15 {
            finalH = 0; finalS = 0; finalL = 5
        } else if sourceH >= 50 && sourceH <= 65 {
            finalH = 35; finalS = 70; finalL = 10
        } else if sourceH >= 65 && sourceH <= 85 {
            finalH = 45; finalS = 55; finalL = 9
        } else {
            finalH = sourceH
            finalS = max(50.0, min(80.0, sourceS * 1.1))
            finalL = 10
        }

        let adjustedL: CGFloat
        if finalS == 0 {
            adjustedL = finalL
        } else if finalH >= 200 && finalH <= 260 {
            adjustedL = 12
        } else if finalH >= 260 && finalH <= 320 {
            adjustedL = 11
        } else if finalH >= 320 || finalH <= 15 {
            adjustedL = 10
        } else if finalH >= 15 && finalH <= 50 {
            adjustedL = 9
        } else if finalH >= 80 && finalH <= 170 {
            adjustedL = 9
        } else {
            adjustedL = 10
        }

        let blurCol = colorFromHSL(h: finalH, s: finalS, l: adjustedL)

        // --- Icon lightness flag for top-right region ---
        let isLight: Bool = {
            var totalLum: CGFloat = 0
            var count: CGFloat = 0
            let startX = sampleW / 2
            let endY = sampleH / 3
            for y in 0..<endY {
                for x in startX..<sampleW {
                    let idx = (y * sampleW + x) * 4
                    let r = CGFloat(rawData[idx]) / 255.0
                    let g = CGFloat(rawData[idx + 1]) / 255.0
                    let b = CGFloat(rawData[idx + 2]) / 255.0
                    totalLum += 0.299 * r + 0.587 * g + 0.114 * b
                    count += 1
                }
            }
            return count > 0 && (totalLum / count) > 0.55
        }()

        let accentUI = UIColor(accentCol)
        let blurUI = UIColor(blurCol)

        colorCache.setObject(accentUI, forKey: url as NSURL)
        blurColorCache.setObject(blurUI, forKey: url as NSURL)
        lightnessCache.setObject(NSNumber(value: isLight), forKey: url as NSURL)

        return (accentUI, blurUI, isLight)
    }

    private func extractDominantColor(from url: URL, loadedImage: UIImage? = nil) {
        // Check color cache first
        if let cachedAccent = Self.colorCache.object(forKey: url as NSURL),
           let cachedBlur = Self.blurColorCache.object(forKey: url as NSURL),
           let cachedLight = Self.lightnessCache.object(forKey: url as NSURL) {
            dominantColor = Color(cachedAccent)
            dominantBlurColor = Color(cachedBlur)
            imageIsLight = cachedLight.boolValue
            return
        }

        Task.detached(priority: .userInitiated) {
            guard let result = await ArticleCardView.extractAndCacheColors(url: url, loadedImage: loadedImage) else { return }
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.3)) {
                    dominantColor = Color(result.accent)
                    dominantBlurColor = Color(result.blur)
                    imageIsLight = result.isLight
                }
            }
        }
    }


    // MARK: - Helpers

    private var categoryGradient: LinearGradient {
        let gradients: [String: [Color]] = [
            "Tech": [Color(hex: "#667eea"), Color(hex: "#764ba2")],
            "Business": [Color(hex: "#11998e"), Color(hex: "#38ef7d")],
            "Finance": [Color(hex: "#f093fb"), Color(hex: "#f5576c")],
            "Politics": [Color(hex: "#4facfe"), Color(hex: "#00f2fe")],
            "World": [Color(hex: "#43e97b"), Color(hex: "#38f9d7")],
            "Science": [Color(hex: "#fa709a"), Color(hex: "#fee140")],
            "Health": [Color(hex: "#a8edea"), Color(hex: "#fed6e3")],
            "Sports": [Color(hex: "#ff9a9e"), Color(hex: "#fecfef")],
            "Entertainment": [Color(hex: "#ffecd2"), Color(hex: "#fcb69f")],
            "Climate": [Color(hex: "#43e97b"), Color(hex: "#38f9d7")]
        ]
        let colors = gradients[article.category ?? ""] ?? [Color(hex: "#667eea"), Color(hex: "#764ba2")]
        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }

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

    // MARK: - Engagement Tracking

    /// Only tracks article_exit with total dwell time.
    /// Engagement signals (article_engaged / article_skipped / article_view)
    /// are sent exclusively by FeedViewModel.recordSwipeAway() to avoid duplicates.
    private func startEngagementTracking() {
        viewStartTime = Date()
    }

    private func stopEngagementTracking() {
        // No timer to cancel — engagement signals handled by FeedViewModel
        if let start = viewStartTime, let articleId = Int(article.id.stringValue) {
            let seconds = Int(Date().timeIntervalSince(start))
            if seconds >= 3 {
                Task {
                    try? await analytics.track(
                        event: "article_exit",
                        articleId: articleId,
                        metadata: ["total_active_seconds": String(seconds)]
                    )
                }
            }
        }
        viewStartTime = nil
    }

    /// Show a quick toast at the top after the user commits to a feedback action.
    private func showLeafFeedbackToast(_ message: String) {
        withAnimation(.easeOut(duration: 0.3)) {
            notInterestedConfirmation = message
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation(.easeOut(duration: 0.3)) {
                notInterestedConfirmation = nil
            }
        }
    }
}

// MARK: - Article Info Modes

private extension Article {
    var availableInfoModes: [ArticleCardView.InfoMode] {
        // Use API components order, only include modes that have data
        let order = availableComponents
        var modes: [ArticleCardView.InfoMode] = []
        for component in order {
            switch component {
            case "details":
                if let d = details, !d.isEmpty { modes.append(.details) }
            case "graph":
                if let g = graph ?? graphData, let pts = g.data, !pts.isEmpty { modes.append(.graph) }
            case "map":
                if let m = map ?? mapData, m.hasMapContent { modes.append(.map) }
            case "timeline":
                if let t = timeline, !t.isEmpty { modes.append(.timeline) }
            default:
                break
            }
        }
        // Always add scorecard if data exists (not dependent on components order)
        if let sc = scorecard, sc.homeTeam != nil, !modes.contains(.scorecard) {
            modes.insert(.scorecard, at: 0)
        }
        return modes
    }
}

// MARK: - Leaf Feedback Sheet
// Long-press gesture on an article card opens this sheet. Users can either
// boost the cluster (Show more like this) or suppress it (Not interested).

private struct LeafFeedbackSheet: View {
    let onMoreLikeThis: () -> Void
    let onNotInterested: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            // Title row
            VStack(spacing: 4) {
                Text("Tune your feed")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.Colors.primaryText)
                Text("Tell us what to do with stories like this")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Colors.secondaryText)
            }
            .padding(.top, 16)

            // Actions grouped card
            VStack(spacing: 0) {
                Button(action: onMoreLikeThis) {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle()
                                .fill(Theme.Colors.boostBackground)
                                .frame(width: 36, height: 36)
                            Image(systemName: "heart.fill")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Theme.Colors.boostText)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Show more like this")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(Theme.Colors.primaryText)
                            Text("Boost similar stories in your feed")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.Colors.secondaryText)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Divider()
                    .padding(.leading, 66)

                Button(action: onNotInterested) {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle()
                                .fill(Theme.Colors.destructive.opacity(0.12))
                                .frame(width: 36, height: 36)
                            Image(systemName: "hand.thumbsdown.fill")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Theme.Colors.destructive)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Not interested")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(Theme.Colors.primaryText)
                            Text("Hide similar stories from your feed")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.Colors.secondaryText)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .background(Theme.Colors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .padding(.horizontal, 16)

            // Cancel as a separate grouped button (iOS action-sheet convention)
            Button(action: onCancel) {
                Text("Cancel")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.Colors.primaryText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.Colors.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .padding(.horizontal, 16)
            }
            .buttonStyle(.plain)

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
