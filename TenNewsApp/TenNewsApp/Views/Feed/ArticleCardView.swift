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

    // Engagement tracking (exit event only — engagement signals sent by FeedViewModel)
    @State private var viewStartTime: Date?
    private let analytics = AnalyticsService()

    private var effectiveColor: Color { dominantColor ?? accentColor }
    private var overlayIconColor: Color { imageIsLight ? Color(white: 0.15) : .white }
    private var effectiveBlurColor: Color { dominantBlurColor ?? accentColor.opacity(0.9) }

    private let padding: CGFloat = 20
    private let imageRatio: CGFloat = 0.42

    /// Device screen corner radius (read via private key, fallback 55)
    private var screenCornerRadius: CGFloat {
        (UIScreen.main.value(forKey: "_displayCornerRadius") as? CGFloat) ?? 55
    }

    enum ContentMode: String, CaseIterable { case bullets, fiveW }
    enum InfoMode: String, CaseIterable, Hashable {
        case details, graph, map, timeline
        var label: String {
            switch self {
            case .details: "Detail"
            case .graph: "Stats"
            case .map: "Map"
            case .timeline: "Time"
            }
        }
        var icon: String {
            switch self {
            case .details: "square.grid.2x2"
            case .graph: "chart.bar.fill"
            case .map: "map.fill"
            case .timeline: "clock.fill"
            }
        }
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let imgH = h * imageRatio

            ZStack(alignment: .top) {
                // Background — tinted with dominant color from image
                effectiveBlurColor.ignoresSafeArea()

                // 1) Hero image — fixed at top
                heroImage(width: w, height: imgH)

                // 2) Dominant-color blur bridge between image and content
                blurBridge(width: w, imageHeight: imgH)

                // 3) Title overlaid on image bottom
                titleOverlay(width: w, imageHeight: imgH)

                // 4) Content area below image
                contentArea(width: w, height: h, imageHeight: imgH)

                // 5) Info box pinned to bottom
                VStack {
                    Spacer()
                    infoBox(maxExpandedHeight: h - imgH - 34 - 36 - 80)
                        .environment(\.colorScheme, .dark)
                        .padding(.horizontal, padding)
                        .padding(.bottom, 80)
                }

                // 6) Floating badges on image
                floatingOverlays
            }
        }
        .overlay {
            if article.isImportant {
                // Match the device's screen corner radius
                RoundedRectangle(cornerRadius: screenCornerRadius)
                    .stroke(effectiveColor.opacity(0.7), lineWidth: 1.5)
                    .padding(4)
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
        VStack(alignment: .leading) {
            Spacer()
            highlightedTitle(article.displayTitle)
        }
        .padding(.horizontal, padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: imageHeight + 24)
    }

    private func highlightedTitle(_ text: String) -> some View {
        text.coloredTitle(
            size: 28,
            weight: .bold,
            baseColor: .white,
            highlightColor: effectiveBlurColor.vivid()
        )
        .lineSpacing(2)
        .tracking(-0.8)
        .shadow(color: .black.opacity(0.35), radius: 8, y: 2)
    }

    // MARK: - Content Area (below image — clean background)

    private func contentArea(width: CGFloat, height: CGFloat, imageHeight: CGFloat) -> some View {
        let contentTop = imageHeight + 34
        let infoBoxBottom: CGFloat = 80 + 85 // padding + info box height
        let availableForBullets = height - contentTop - 36 - 8 - infoBoxBottom - 8

        return VStack(alignment: .leading, spacing: 0) {
            Spacer().frame(height: contentTop)

            // Glass control bar — always right under the title
            controlBar
                .padding(.horizontal, padding)

            // Content — bullets or 5W, fills space between tool box and info box
            Group {
                switch contentMode {
                case .bullets:
                    bulletsList(availableHeight: availableForBullets)
                case .fiveW:
                    fiveWsList(availableHeight: availableForBullets)
                }
            }
            .padding(.top, 8)
            .padding(.horizontal, padding)

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

                        TimeAgoText(article.publishedAt, color: .white)
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
        let bullets = article.displayBullets

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
                    .frame(maxHeight: .infinity)
                }
            }
            .frame(height: availableHeight)
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

    // MARK: - Info Box (controlled by infoMode toggle)

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
            .glassEffect(.regular.tint(.black.opacity(0.15)).interactive(), in: RoundedRectangle(cornerRadius: 22))
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
            .glassEffect(.regular.tint(.black.opacity(0.15)).interactive(), in: RoundedRectangle(cornerRadius: 22))
        }
    }

    private func compactGraph(points: [GraphPoint], graph: GraphData, expandedHeight: CGFloat) -> some View {
        let maxVal = points.map(\.displayValue).max() ?? 1

        return GlassEffectContainer {
            VStack(spacing: 0) {
                if graphExpanded {
                    // Expanded: full glass bar chart
                    VStack(alignment: .leading, spacing: 0) {
                        if let title = graph.title, !title.isEmpty {
                            Text(title.uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.white.opacity(0.4))
                                .tracking(0.8)
                                .padding(.top, 14)
                                .padding(.horizontal, 16)
                        }

                        // Bar chart area
                        HStack(alignment: .bottom, spacing: points.count > 8 ? 3 : 6) {
                            ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                                let ratio = maxVal > 0 ? CGFloat(point.displayValue / maxVal) : 0

                                VStack(spacing: 5) {
                                    Spacer(minLength: 0)

                                    Text(formatStatValue(point.displayValue))
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(.white.opacity(0.7))
                                        .lineLimit(1)
                                        .minimumScaleFactor(0.5)

                                    RoundedRectangle(cornerRadius: 5)
                                        .fill(.clear)
                                        .frame(maxWidth: .infinity)
                                        .frame(height: graphAnimated ? max(ratio * (max(expandedHeight, 200) - 90), 6) : 6)
                                        .glassEffect(
                                            .regular.tint(effectiveColor.opacity(0.4 + ratio * 0.3)).interactive(),
                                            in: RoundedRectangle(cornerRadius: 5)
                                        )

                                    Text(point.displayLabel)
                                        .font(.system(size: 8, weight: .medium))
                                        .foregroundStyle(.white.opacity(0.45))
                                        .lineLimit(1)
                                        .minimumScaleFactor(0.5)
                                        .frame(maxWidth: .infinity)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 10)
                        .padding(.bottom, 14)
                    }
                    .frame(height: max(expandedHeight, 200))
                } else {
                    // Collapsed: mini glass bar chart preview with title
                    VStack(alignment: .leading, spacing: 0) {
                        if let title = graph.title, !title.isEmpty {
                            Text(title.uppercased())
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(.white.opacity(0.4))
                                .tracking(0.8)
                                .padding(.top, 10)
                                .padding(.leading, 14)
                        }

                        HStack(alignment: .bottom, spacing: points.count > 8 ? 2 : 4) {
                            ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                                let ratio = maxVal > 0 ? CGFloat(point.displayValue / maxVal) : 0

                                VStack(spacing: 3) {
                                    Spacer(minLength: 0)

                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(.clear)
                                        .frame(maxWidth: .infinity)
                                        .frame(height: max(ratio * 38, 5))
                                        .glassEffect(
                                            .regular.tint(effectiveColor.opacity(0.3 + ratio * 0.35)).interactive(),
                                            in: RoundedRectangle(cornerRadius: 4)
                                        )

                                    Text(point.displayLabel)
                                        .font(.system(size: 7, weight: .medium))
                                        .foregroundStyle(.white.opacity(0.35))
                                        .lineLimit(1)
                                        .minimumScaleFactor(0.4)
                                        .frame(maxWidth: .infinity)
                                }
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.bottom, 8)
                    }
                    .frame(height: 85)
                }
            }
            .glassEffect(.regular.tint(.black.opacity(0.15)).interactive(), in: RoundedRectangle(cornerRadius: 22))
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
                        .glassEffect(.regular.tint(.black.opacity(0.15)).interactive(), in: Circle())
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
            .glassEffect(.regular.tint(.black.opacity(0.15)).interactive(), in: RoundedRectangle(cornerRadius: 22))
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
                        .glassEffect(.regular.tint(.black.opacity(0.15)).interactive(), in: Circle())
                }
                .padding(8)
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: timelineExpanded)
        }
    }

    // MARK: - Floating Overlays

    private var floatingOverlays: some View {
        VStack {
            HStack(alignment: .top) {
                Spacer()

                HStack(alignment: .top, spacing: 10) {
                    if let event = article.worldEvent {
                        eventBadge(event)
                    }
                    VStack(spacing: 8) {
                        shareButton
                        saveButton
                    }
                }
            }
            .padding(.horizontal, padding)
            .padding(.top, 56)

            Spacer()
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

    private var shareButton: some View {
        ShareLink(item: URL(string: article.url ?? "https://tennews.ai")!,
                  subject: Text(article.plainTitle),
                  message: Text(article.displaySummary)) {
            Image(systemName: "arrowshape.turn.up.right.fill")
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .simultaneousGesture(TapGesture().onEnded { HapticManager.light() })
    }

    private var saveButton: some View {
        Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                BookmarkManager.shared.toggle(article)
            }
            HapticManager.light()
        } label: {
            Image(systemName: BookmarkManager.shared.isBookmarked(article.id) ? "bookmark.fill" : "bookmark")
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 12))
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

    private func extractDominantColor(from url: URL) {
        // Check color cache first
        if let cachedAccent = Self.colorCache.object(forKey: url as NSURL),
           let cachedBlur = Self.blurColorCache.object(forKey: url as NSURL),
           let cachedLight = Self.lightnessCache.object(forKey: url as NSURL) {
            dominantColor = Color(cachedAccent)
            dominantBlurColor = Color(cachedBlur)
            imageIsLight = cachedLight.boolValue
            return
        }

        Task.detached(priority: .background) {
            // Wait for AsyncCachedImage to cache the image (avoids duplicate download)
            var uiImage: UIImage?
            for _ in 0..<30 {
                if let cached = AsyncCachedImage.cache.object(forKey: url as NSURL) {
                    uiImage = cached
                    break
                }
                try? await Task.sleep(nanoseconds: 100_000_000) // 100ms intervals, up to 3s
            }
            // Last resort: download if AsyncCachedImage hasn't cached it yet
            if uiImage == nil {
                guard let (data, _) = try? await URLSession.shared.data(from: url),
                      let downloaded = UIImage(data: data) else { return }
                AsyncCachedImage.cache.setObject(downloaded, forKey: url as NSURL)
                uiImage = downloaded
            }
            guard let uiImage, let cgImage = uiImage.cgImage else { return }

                let sampleW = min(cgImage.width, 80)
                let sampleH = min(cgImage.height, 80)
                let colorSpace = CGColorSpaceCreateDeviceRGB()
                var rawData = [UInt8](repeating: 0, count: sampleW * sampleH * 4)

                guard let context = CGContext(
                    data: &rawData, width: sampleW, height: sampleH,
                    bitsPerComponent: 8, bytesPerRow: sampleW * 4, space: colorSpace,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                ) else { return }

                context.draw(cgImage, in: CGRect(x: 0, y: 0, width: sampleW, height: sampleH))

                // --- Step 1: Bucket pixels into 15-unit RGB clusters ---
                struct ColorBucket {
                    var count: Int = 0
                    var positions: Set<String> = []
                    var rKey: Int
                    var gKey: Int
                    var bKey: Int
                }

                var buckets: [String: ColorBucket] = [:]
                let totalPixels = sampleW * sampleH

                for i in stride(from: 0, to: totalPixels * 4, by: 10 * 4) {
                    let r = Int(rawData[i])
                    let g = Int(rawData[i + 1])
                    let b = Int(rawData[i + 2])
                    let a = Int(rawData[i + 3])

                    // Skip transparent, pure white, pure black
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

                    if buckets[key] == nil {
                        buckets[key] = ColorBucket(rKey: rK, gKey: gK, bKey: bK)
                    }
                    buckets[key]!.count += 1
                    buckets[key]!.positions.insert("\(px),\(py)")
                }

                guard !buckets.isEmpty else { return }

                // --- Step 2: Convert to HSL and filter ---
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

                var candidates: [ScoredColor] = buckets.values.compactMap { bucket in
                    let r = CGFloat(bucket.rKey) / 255.0
                    let g = CGFloat(bucket.gKey) / 255.0
                    let b = CGFloat(bucket.bKey) / 255.0
                    let hsl = ArticleCardView.rgbToHSL(r, g, b)

                    // Filter: sat >= 35%, lightness 20-80%
                    guard hsl.s >= 35 && hsl.l >= 20 && hsl.l <= 80 else { return nil }

                    return ScoredColor(
                        h: hsl.h, s: hsl.s, l: hsl.l,
                        count: bucket.count, coverage: bucket.positions.count
                    )
                }

                // Fallback: if no colorful candidates, use most saturated bucket
                if candidates.isEmpty {
                    let fallback = buckets.values.max(by: {
                        let hsl0 = ArticleCardView.rgbToHSL(CGFloat($0.rKey)/255, CGFloat($0.gKey)/255, CGFloat($0.bKey)/255)
                        let hsl1 = ArticleCardView.rgbToHSL(CGFloat($1.rKey)/255, CGFloat($1.gKey)/255, CGFloat($1.bKey)/255)
                        return hsl0.s < hsl1.s
                    })
                    if let fb = fallback {
                        let hsl = ArticleCardView.rgbToHSL(CGFloat(fb.rKey)/255, CGFloat(fb.gKey)/255, CGFloat(fb.bKey)/255)
                        candidates = [ScoredColor(h: hsl.h, s: hsl.s, l: hsl.l, count: fb.count, coverage: fb.positions.count)]
                    }
                }

                guard !candidates.isEmpty else { return }

                // --- Step 3: Composite scoring ---
                // Frequency 50%, Saturation 30%, Coverage 20%
                for i in candidates.indices {
                    let normFreq = CGFloat(candidates[i].count) / maxCount
                    let normSat = candidates[i].s / 100.0
                    let normCov = CGFloat(candidates[i].coverage) / maxCoverage

                    var score = normFreq * 0.50 + normSat * 0.30 + normCov * 0.20

                    // Penalize dull sky-blue (hue 200-220, sat < 60)
                    if candidates[i].h >= 200 && candidates[i].h <= 220 && candidates[i].s < 60 {
                        score *= 0.85
                    }

                    // Penalize brown/olive (hue 15-50, sat < 65) — too common in news photos
                    if candidates[i].h >= 15 && candidates[i].h <= 50 && candidates[i].s < 65 {
                        score *= 0.7
                    }

                    candidates[i].score = score
                }

                candidates.sort { $0.score > $1.score }
                let winner = candidates[0]

                // --- Step 4: Create color variants ---
                let hue = winner.h
                let winSat = winner.s

                // Blur color: same hue, very dark — compensate for perceptually bright hues
                var blurL = max(12.0, min(20.0, winner.l * 0.28))
                var blurS = max(30.0, min(50.0, winSat * 0.55))

                // Yellow/green/orange hues appear brighter — push even darker
                if hue >= 30 && hue <= 180 {
                    blurL = max(10.0, blurL * 0.7)
                    blurS = min(40.0, blurS * 0.7)
                }
                let blurCol = ArticleCardView.colorFromHSL(h: hue, s: blurS, l: blurL)

                // Accent color: same hue, sat boosted 15% (cap 90%), lightness 55-75%
                let accentS = min(90.0, winSat * 1.15)
                let accentL: CGFloat = winner.l <= 40
                    ? 55.0 + (winner.l / 40.0) * 10.0
                    : 65.0 + ((winner.l - 40.0) / 40.0) * 10.0
                let accentCol = ArticleCardView.colorFromHSL(
                    h: hue,
                    s: max(65.0, accentS),
                    l: max(55.0, min(75.0, accentL))
                )

                // Compute average brightness of top-right region (where icons sit)
                let isLight: Bool = {
                    var totalLum: CGFloat = 0
                    var count: CGFloat = 0
                    let startX = sampleW / 2
                    let endY = sampleH / 3
                    for y in 0..<endY {
                        for x in startX..<sampleW {
                            let i = (y * sampleW + x) * 4
                            let r = CGFloat(rawData[i]) / 255.0
                            let g = CGFloat(rawData[i + 1]) / 255.0
                            let b = CGFloat(rawData[i + 2]) / 255.0
                            totalLum += 0.299 * r + 0.587 * g + 0.114 * b
                            count += 1
                        }
                    }
                    return count > 0 && (totalLum / count) > 0.55
                }()

                // Cache the results
                ArticleCardView.colorCache.setObject(UIColor(accentCol), forKey: url as NSURL)
                ArticleCardView.blurColorCache.setObject(UIColor(blurCol), forKey: url as NSURL)
                ArticleCardView.lightnessCache.setObject(NSNumber(value: isLight), forKey: url as NSURL)

                await MainActor.run {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        dominantColor = accentCol
                        dominantBlurColor = blurCol
                        imageIsLight = isLight
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
        if modes.isEmpty { modes.append(.details) }
        return modes
    }
}
