import SwiftUI

// MARK: - Article Card View (Matches website design exactly)

struct ArticleCardView: View {
    let article: Article
    let accentColor: Color
    @State private var selectedComponent: String = "details"
    @State private var showDetail = false

    // Layout constants matching website CSS variables
    private let imageHeightRatio: CGFloat = 0.42  // --image-height: 42vh
    private let contentPadding: CGFloat = 16       // --content-padding
    private let titleSize: CGFloat = 28            // --title-size
    private let bulletSize: CGFloat = 15           // --bullet-size
    private let timeSize: CGFloat = 13             // --time-size

    var body: some View {
        GeometryReader { geo in
            let imageHeight = geo.size.height * imageHeightRatio

            ZStack(alignment: .top) {
                // Background
                Color.white.ignoresSafeArea()

                // 1. Hero Image Section
                heroImageSection(imageHeight: imageHeight, width: geo.size.width)

                // 2. Content Area (white, rounded top corners, overlaps image)
                contentArea(imageHeight: imageHeight, totalHeight: geo.size.height)

                // 3. Floating Overlays (MUST KNOW, Event Badge, Share)
                floatingOverlays
            }
        }
        .ignoresSafeArea()
        .fullScreenCover(isPresented: $showDetail) {
            ArticleDetailView(articleId: article.id, initialArticle: article)
        }
    }

    // MARK: - Hero Image

    @ViewBuilder
    private func heroImageSection(imageHeight: CGFloat, width: CGFloat) -> some View {
        ZStack(alignment: .bottom) {
            // Image or category gradient fallback
            if let imageUrl = article.displayImage {
                AsyncCachedImage(url: imageUrl, aspectRatio: nil)
                    .frame(width: width, height: imageHeight)
                    .clipped()
            } else {
                // Category gradient fallback
                categoryGradient
                    .frame(width: width, height: imageHeight)
                    .overlay {
                        VStack(spacing: 12) {
                            Text(article.emoji ?? "📰")
                                .font(.system(size: 56))
                            Text((article.category ?? "News").uppercased())
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.9))
                                .tracking(2)
                        }
                    }
            }

            // Gradient overlay for title readability
            LinearGradient(
                stops: [
                    .init(color: accentColor.opacity(0.15), location: 0.0),
                    .init(color: accentColor.opacity(0.25), location: 0.1),
                    .init(color: accentColor.opacity(0.45), location: 0.3),
                    .init(color: accentColor.opacity(0.65), location: 0.5),
                    .init(color: accentColor.opacity(0.85), location: 0.7),
                    .init(color: accentColor.opacity(0.95), location: 0.8),
                    .init(color: accentColor.opacity(0.98), location: 0.9),
                    .init(color: accentColor, location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: imageHeight)

            // Title overlaid on gradient
            titleOverlay
                .padding(.horizontal, contentPadding)
                .padding(.bottom, 28)
        }
        .frame(height: imageHeight)
    }

    // MARK: - Title with Highlighted Keywords

    private var titleOverlay: some View {
        HStack {
            highlightedTitle(article.displayTitle)
                .lineLimit(3)
            Spacer(minLength: 0)
        }
    }

    private func highlightedTitle(_ text: String) -> some View {
        // Parse **bold** markers and render with highlight color
        let parts = text.components(separatedBy: "**")
        var views: [Text] = []

        for (i, part) in parts.enumerated() {
            if part.isEmpty { continue }
            if i % 2 == 1 {
                // Bold/highlighted keyword
                views.append(
                    Text(part)
                        .font(.system(size: titleSize, weight: .bold))
                        .foregroundColor(highlightColor)
                )
            } else {
                views.append(
                    Text(part)
                        .font(.system(size: titleSize, weight: .bold))
                        .foregroundColor(.white)
                )
            }
        }

        let combined = views.reduce(Text("")) { $0 + $1 }
        return combined
            .lineSpacing(2)
            .tracking(-0.8)
    }

    // MARK: - Content Area

    private func contentArea(imageHeight: CGFloat, totalHeight: CGFloat) -> some View {
        let contentStart = imageHeight - 20 // Slight overlap with rounded corners

        return VStack(spacing: 0) {
            Spacer().frame(height: contentStart)

            VStack(alignment: .leading, spacing: 0) {
                // Rounded white background for content
                VStack(alignment: .leading, spacing: 0) {
                    // Source row + component switcher
                    sourceRow
                        .padding(.top, 18)
                        .padding(.horizontal, contentPadding)

                    // Bullet points
                    bulletsList(availableHeight: totalHeight - imageHeight - 160)
                        .padding(.horizontal, contentPadding)
                        .padding(.top, 8)
                }
                .background(
                    UnevenRoundedRectangle(
                        topLeadingRadius: 22,
                        topTrailingRadius: 22
                    )
                    .fill(Color.white)
                    .shadow(color: .black.opacity(0.04), radius: 1, y: -1)
                )

                // Info box at the very bottom
                infoBox
                    .padding(.horizontal, contentPadding)
                    .background(Color.white)
            }
        }
    }

    // MARK: - Source Row

    private var sourceRow: some View {
        HStack {
            // Left: source initial + time
            HStack(spacing: 8) {
                if let source = article.source {
                    // Source initial circle (like publisher logo)
                    Text(String(source.prefix(1)).uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 18, height: 18)
                        .background(accentColor.opacity(0.8))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }

                TimeAgoText(article.publishedAt)
            }

            Spacer()

            // Right: component switcher
            componentSwitcher
        }
    }

    // MARK: - Component Switcher (matches website's glass pill switcher)

    private var componentSwitcher: some View {
        GlassEffectContainer {
            HStack(spacing: 4) {
                ForEach(article.availableComponents, id: \.self) { type in
                    Button {
                        withAnimation(AppAnimations.quickSpring) {
                            selectedComponent = type
                        }
                        HapticManager.selection()
                    } label: {
                        componentIcon(for: type)
                            .frame(width: 30, height: 30)
                            .glassEffect(
                                selectedComponent == type
                                    ? .regular.tint(.blue).interactive()
                                    : .regular.interactive(),
                                in: RoundedRectangle(cornerRadius: 8)
                            )
                            .glassEffectID(type, in: switcherNamespace)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(3)
        }
    }

    @Namespace private var switcherNamespace

    @ViewBuilder
    private func componentIcon(for type: String) -> some View {
        switch type {
        case "timeline":
            // Timeline list icon (3 dots with bars)
            VStack(spacing: 2.5) {
                ForEach(0..<3, id: \.self) { _ in
                    HStack(spacing: 3) {
                        Circle()
                            .fill(Color.primary)
                            .frame(width: 3, height: 3)
                        RoundedRectangle(cornerRadius: 1)
                            .fill(Color.primary)
                            .frame(width: 8, height: 2)
                    }
                }
            }
        case "details":
            // 2x2 grid icon
            VStack(spacing: 2) {
                HStack(spacing: 2) {
                    RoundedRectangle(cornerRadius: 1.5).fill(Color.primary).frame(width: 5, height: 5)
                    RoundedRectangle(cornerRadius: 1.5).fill(Color.primary).frame(width: 5, height: 5)
                }
                HStack(spacing: 2) {
                    RoundedRectangle(cornerRadius: 1.5).fill(Color.primary).frame(width: 5, height: 5)
                    RoundedRectangle(cornerRadius: 1.5).fill(Color.primary).frame(width: 5, height: 5)
                }
            }
        case "map":
            // Map crosshair icon
            Circle()
                .strokeBorder(Color.primary, lineWidth: 2)
                .frame(width: 10, height: 10)
                .overlay(Circle().fill(Color.primary).frame(width: 4, height: 4))
        case "graph":
            // Bar chart icon
            HStack(alignment: .bottom, spacing: 1.5) {
                RoundedRectangle(cornerRadius: 1).fill(Color.primary).frame(width: 2.5, height: 3)
                RoundedRectangle(cornerRadius: 1).fill(Color.primary).frame(width: 2.5, height: 6)
                RoundedRectangle(cornerRadius: 1).fill(Color.primary).frame(width: 2.5, height: 4)
                RoundedRectangle(cornerRadius: 1).fill(Color.primary).frame(width: 2.5, height: 8)
            }
        default:
            Image(systemName: "doc.text")
                .font(.system(size: 12))
        }
    }

    // MARK: - Bullet Points List

    @ViewBuilder
    private func bulletsList(availableHeight: CGFloat) -> some View {
        let bullets = article.displayBullets

        if !bullets.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(bullets.prefix(4).enumerated()), id: \.offset) { _, bullet in
                    HStack(alignment: .top, spacing: 12) {
                        // Bullet dot (colored circle matching website)
                        Circle()
                            .fill(accentColor)
                            .frame(width: 6, height: 6)
                            .padding(.top, 7)

                        // Bullet text with bold highlighting
                        highlightedBullet(bullet)
                            .font(.system(size: bulletSize))
                            .foregroundStyle(Color(hex: "#1d1d1f").opacity(0.85))
                            .lineSpacing(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxHeight: .infinity)
                }
            }
            .frame(height: max(availableHeight, 160))
        }
    }

    private func highlightedBullet(_ text: String) -> some View {
        let parts = text.components(separatedBy: "**")
        var views: [Text] = []
        for (i, part) in parts.enumerated() {
            if part.isEmpty { continue }
            if i % 2 == 1 {
                views.append(Text(part).fontWeight(.bold).foregroundColor(Color(hex: "#1d1d1f")))
            } else {
                views.append(Text(part))
            }
        }
        return views.reduce(Text("")) { $0 + $1 }
    }

    // MARK: - Info Box (bottom fixed panel for details/timeline/map/graph)

    private var infoBox: some View {
        Group {
            switch selectedComponent {
            case "details":
                detailsInfoBox
            case "timeline":
                if let timeline = article.timeline, !timeline.isEmpty {
                    compactTimeline(entries: timeline)
                }
            case "graph":
                if let graph = article.graph ?? article.graphData, let points = graph.data, !points.isEmpty {
                    compactStats(points: points)
                }
            default:
                EmptyView()
            }
        }
        .padding(.top, 4)
        .padding(.bottom, 8)
    }

    // MARK: - Details Info Box (key-value stat boxes)

    private var detailsInfoBox: some View {
        Group {
            if let details = article.details, !details.isEmpty {
                let displayItems = Array(details.prefix(3))
                HStack(spacing: 0) {
                    ForEach(Array(displayItems.enumerated()), id: \.offset) { _, item in
                        VStack(spacing: 4) {
                            Text(item.displayLabel.uppercased())
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(Color(hex: "#86868b"))
                                .tracking(0.5)
                                .multilineTextAlignment(.center)
                                .lineLimit(2)

                            Text(item.displayValue)
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(accentColor)

                            if !item.displayLabel.isEmpty {
                                Text(item.displayLabel.lowercased())
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color(hex: "#86868b"))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                }
                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 16))
            } else if let graph = article.graph ?? article.graphData, let points = graph.data, !points.isEmpty {
                compactStats(points: points)
            }
        }
    }

    private func compactStats(points: [GraphPoint]) -> some View {
        let displayPoints = Array(points.prefix(3))
        return HStack(spacing: 0) {
            ForEach(Array(displayPoints.enumerated()), id: \.offset) { _, point in
                VStack(spacing: 4) {
                    Text(point.displayLabel.uppercased())
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color(hex: "#86868b"))
                        .tracking(0.5)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)

                    Text(formatStatValue(point.displayValue))
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(accentColor)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
        }
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 16))
    }

    private func compactTimeline(entries: [TimelineEntry]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(entries.prefix(3).enumerated()), id: \.offset) { _, entry in
                HStack(alignment: .top, spacing: 10) {
                    // Timeline dot + line
                    VStack(spacing: 0) {
                        Circle()
                            .fill(accentColor)
                            .frame(width: 8, height: 8)
                        if entry.id != entries.prefix(3).last?.id {
                            Rectangle()
                                .fill(Color(hex: "#e5e5ea"))
                                .frame(width: 1.5)
                                .frame(maxHeight: .infinity)
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        if let date = entry.date {
                            Text(date)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(accentColor)
                        }
                        Text(entry.displayText)
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: "#1d1d1f").opacity(0.8))
                            .lineLimit(2)
                    }
                }
            }
        }
        .padding(12)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Floating Overlays

    private var floatingOverlays: some View {
        VStack {
            HStack {
                // MUST KNOW badge (top-left)
                if article.isImportant {
                    mustKnowBadge
                }

                Spacer()

                // Event badge + Share button (top-right)
                HStack(spacing: 10) {
                    if let event = article.worldEvent {
                        eventBadge(event)
                    }
                    shareButton
                }
            }
            .padding(.horizontal, contentPadding)
            .padding(.top, 56) // Below safe area

            Spacer()
        }
    }

    private var mustKnowBadge: some View {
        HStack(spacing: 6) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 12))
                .foregroundStyle(.white)
            Text("MUST KNOW")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white)
                .tracking(0.5)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 0)
        .frame(height: 34)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 12))
    }

    private func eventBadge(_ event: ArticleWorldEvent) -> some View {
        Text(event.name)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.white)
            .tracking(0.2)
            .lineLimit(1)
            .padding(.horizontal, 14)
            .frame(height: 34)
            .frame(maxWidth: 160)
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 12))
    }

    private var shareButton: some View {
        Button {
            HapticManager.light()
        } label: {
            Image(systemName: "arrowshape.turn.up.right.fill")
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 12))
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

    private var highlightColor: Color {
        // Generate a bright highlight color based on category
        let hues: [String: Double] = [
            "World": 220, "Politics": 0, "Business": 150,
            "Tech": 270, "Science": 180, "Health": 330,
            "Sports": 25, "Entertainment": 50, "Finance": 140,
            "Climate": 160
        ]
        let hue = hues[article.category ?? ""] ?? 220
        return Color(hue: hue / 360, saturation: 0.7, brightness: 0.95)
    }

    private func formatStatValue(_ value: Double) -> String {
        if value >= 1_000_000_000 {
            return String(format: "$%.1fB", value / 1_000_000_000)
        } else if value >= 1_000_000 {
            return String(format: "$%.1fM", value / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "%.1fK", value / 1_000)
        } else if value == value.rounded() {
            return String(format: "%.0f", value)
        } else {
            return String(format: "%.1f", value)
        }
    }
}
