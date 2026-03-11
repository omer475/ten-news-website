import SwiftUI

struct ExploreView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(FeedViewModel.self) private var feedViewModel
    @State private var topics: [ExploreTopic] = []
    @State private var isLoading = true
    @State private var searchText = ""
    @State private var selectedArticle: Article?
    @State private var appeared = false

    private var userId: String? { appViewModel.currentUser?.id }

    private var filteredTopics: [ExploreTopic] {
        if searchText.isEmpty { return topics }
        return topics.filter {
            $0.displayTitle.localizedCaseInsensitiveContains(searchText) ||
            $0.category.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var personalizedTopics: [ExploreTopic] {
        filteredTopics.filter(\.isPersonalized)
    }

    private var trendingTopics: [ExploreTopic] {
        filteredTopics.filter(\.isTrending)
    }

    /// Group topics by category, preserving order of first appearance
    private func groupedByCategory(_ topics: [ExploreTopic]) -> [(category: String, topics: [ExploreTopic])] {
        var order: [String] = []
        var map: [String: [ExploreTopic]] = [:]
        for topic in topics {
            if map[topic.category] == nil {
                order.append(topic.category)
            }
            map[topic.category, default: []].append(topic)
        }
        return order.map { (category: $0, topics: map[$0]!) }
    }

    var body: some View {
        ZStack {
            NavigationStack {
                Group {
                    if isLoading && topics.isEmpty {
                        loadingState
                    } else if topics.isEmpty {
                        emptyState
                    } else {
                        mainContent
                    }
                }
                .background(Theme.Colors.backgroundPrimary)
                .navigationTitle("Explore")
                .navigationBarTitleDisplayMode(.large)
                .searchable(text: $searchText, prompt: "Search topics")
                .task { await loadTopics() }
                .refreshable { await loadTopics() }
            }

            // Article overlay
            if let article = selectedArticle {
                ExploreArticleSheet(
                    selectedArticle: article,
                    allArticles: feedViewModel.allArticles
                ) {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                        selectedArticle = nil
                    }
                }
                .transition(.move(edge: .bottom))
                .ignoresSafeArea()
                .zIndex(1)
            }
        }
    }

    // MARK: - Main Content

    private var mainContent: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: 32) {
                // For You
                if !personalizedTopics.isEmpty {
                    sectionHeader(
                        title: "FOR YOU",
                        icon: "sparkles",
                        iconColor: Color(hex: "#AF52DE"),
                        subtitle: "Based on your interests"
                    )
                    .sectionAppear(appeared: appeared, index: 0)

                    let groups = groupedByCategory(personalizedTopics)
                    ForEach(Array(groups.enumerated()), id: \.element.category) { gIndex, group in
                        categoryGroup(group.category, topics: group.topics)
                            .sectionAppear(appeared: appeared, index: gIndex + 1)
                    }
                }

                // Trending
                if !trendingTopics.isEmpty {
                    sectionHeader(
                        title: "TRENDING",
                        icon: "chart.line.uptrend.xyaxis",
                        iconColor: Color(hex: "#FF9500"),
                        subtitle: "Popular right now"
                    )

                    let groups = groupedByCategory(trendingTopics)
                    let offset = groupedByCategory(personalizedTopics).count + 1
                    ForEach(Array(groups.enumerated()), id: \.element.category) { gIndex, group in
                        categoryGroup(group.category, topics: group.topics)
                            .sectionAppear(appeared: appeared, index: offset + gIndex + 1)
                    }
                }

                Spacer(minLength: 100)
            }
            .padding(.top, 8)
        }
    }

    // MARK: - Section Header (FOR YOU / TRENDING)

    private func sectionHeader(title: String, icon: String, iconColor: Color, subtitle: String) -> some View {
        HStack(alignment: .bottom) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(iconColor)
                    .frame(width: 26, height: 26)
                    .background(iconColor.opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: 7))

                Text(title)
                    .font(.system(size: 13, weight: .heavy))
                    .tracking(1.0)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(subtitle)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Category Group (e.g. "Football" with entities underneath)

    private func categoryGroup(_ category: String, topics: [ExploreTopic]) -> some View {
        let catColor = categoryColor(for: category)

        return VStack(alignment: .leading, spacing: 16) {
            // Category header
            HStack(spacing: 8) {
                Text(category)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.primary)

                Text("\(topics.count) topics")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 20)

            // Entity rows within this category
            ForEach(topics) { topic in
                entityRow(topic, catColor: catColor)
            }
        }
    }

    // MARK: - Entity Row (title + horizontal article scroll)

    private func entityRow(_ topic: ExploreTopic, catColor: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Entity header — no emoji
            HStack(spacing: 0) {
                Text(topic.displayTitle)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                Text("  ·  \(topic.articles.count) articles")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.tertiary)

                Spacer()
            }
            .padding(.horizontal, 20)

            // Horizontal article scroll
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 14) {
                    ForEach(topic.articles) { article in
                        Button {
                            openArticle(article)
                        } label: {
                            ExploreArticleCard(
                                article: article,
                                fallbackColor: catColor,
                                cardWidth: cardWidth,
                                cardHeight: cardHeight
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .scrollTargetLayout()
                .padding(.horizontal, 20)
            }
            .scrollTargetBehavior(.viewAligned)
        }
    }

    // MARK: - Layout Constants

    private var cardWidth: CGFloat {
        UIScreen.main.bounds.width - 40
    }

    private let cardHeight: CGFloat = 280

    // MARK: - Loading

    private var loadingState: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: 28) {
                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 10) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(.fill.quaternary)
                            .frame(width: 120, height: 20)
                            .padding(.horizontal, 20)

                        VStack(alignment: .leading, spacing: 6) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(.fill.quaternary)
                                .frame(width: 160, height: 16)
                        }
                        .padding(.horizontal, 20)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 14) {
                                ForEach(0..<2, id: \.self) { _ in
                                    RoundedRectangle(cornerRadius: 18)
                                        .fill(.fill.tertiary)
                                        .frame(width: UIScreen.main.bounds.width - 40, height: 280)
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                    }
                    .redacted(reason: .placeholder)
                    .shimmer()
                }
            }
            .padding(.top, 16)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkle.magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.quaternary)

            Text("No Topics Yet")
                .font(.system(size: 18, weight: .semibold))

            Text("Topics will appear here based on your interests and trending stories.")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - API

    private func loadTopics() async {
        isLoading = true
        var endpoint = "/api/explore/topics"
        if let uid = userId {
            endpoint += "?user_id=\(uid)"
        }
        do {
            let response: ExploreTopicsResponse = try await APIClient.shared.get(endpoint)
            topics = response.topics
        } catch {
            // Keep existing data on refresh failure
        }
        isLoading = false
        withAnimation(.easeOut(duration: 0.4)) { appeared = true }
    }

    // MARK: - Open Article

    private func openArticle(_ topicArticle: ExploreTopicArticle) {
        HapticManager.selection()
        Task {
            if let full: Article = try? await APIClient.shared.get("/api/article/\(topicArticle.id.stringValue)") {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                    selectedArticle = full
                }
            }
        }
    }

    // MARK: - Helpers

    private func categoryColor(for category: String) -> Color {
        let colors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Soccer": "#DD6622", "Entertainment": "#CC9922",
            "Finance": "#228866", "Climate": "#339966", "Economy": "#228866",
            "Crypto": "#F7931A", "AI": "#7744BB", "NFL": "#013369",
            "NBA": "#C9082A", "Baseball": "#002D72", "F1": "#E10600",
            "US Politics": "#CC3344", "World Politics": "#3366CC",
            "AI & Tech": "#7744BB", "K-Pop & Music": "#CC9922",
            "Motorsport": "#E10600", "Combat Sports": "#DD6622",
            "Sports Events": "#DD6622", "Automotive": "#336699",
            "Gaming": "#7744BB", "Fashion": "#CC6699", "Skincare": "#CC6699",
            "Beauty": "#CC6699", "Lifestyle": "#CC9922", "Food": "#22AA66",
        ]
        return Color(hex: colors[category] ?? "#3366CC")
    }
}

// MARK: - Explore Article Card (extracts dominant color from image)

struct ExploreArticleCard: View {
    let article: ExploreTopicArticle
    let fallbackColor: Color
    let cardWidth: CGFloat
    let cardHeight: CGFloat

    @State private var dominantColor: Color?

    private var highlightColor: Color {
        (dominantColor ?? fallbackColor).vivid()
    }

    private var glassColor: Color {
        dominantColor ?? fallbackColor
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Full-bleed image
            if let imageUrl = article.imageUrl, let url = URL(string: imageUrl) {
                AsyncCachedImage(url: url, contentMode: .fill)
                    .frame(width: cardWidth, height: cardHeight)
                    .clipped()
                    .onAppear { extractColor(from: url) }
            } else {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [fallbackColor.opacity(0.6), fallbackColor.opacity(0.2), Color(white: 0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: cardWidth, height: cardHeight)
            }

            // Liquid glass — covers full card, masked to fade from 0% at top to 100% at bottom
            Color.clear
                .frame(width: cardWidth, height: cardHeight)
                .glassEffect(
                    .regular.tint(glassColor.opacity(0.5)),
                    in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                )
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0.0),
                            .init(color: .clear, location: 0.05),
                            .init(color: .white.opacity(0.2), location: 0.2),
                            .init(color: .white.opacity(0.5), location: 0.4),
                            .init(color: .white.opacity(0.8), location: 0.6),
                            .init(color: .white, location: 0.75),
                            .init(color: .white, location: 1.0),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .allowsHitTesting(false)

            // Text content at the bottom
            VStack(alignment: .leading, spacing: 6) {
                article.title.coloredTitle(
                    size: 26,
                    weight: .bold,
                    baseColor: .white,
                    highlightColor: highlightColor
                )
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .shadow(color: .black.opacity(0.3), radius: 4, y: 2)

                HStack(spacing: 6) {
                    if let category = article.category {
                        Text(category)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.85))
                    }
                    if !article.relativeTime.isEmpty {
                        Text("·")
                            .foregroundStyle(.white.opacity(0.5))
                        Text(article.relativeTime)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white.opacity(0.65))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 14)
            .frame(width: cardWidth, alignment: .bottomLeading)
        }
        .frame(width: cardWidth, height: cardHeight)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    // MARK: - Dominant Color Extraction (lightweight, from cached image)

    private func extractColor(from url: URL) {
        Task.detached(priority: .background) {
            // Wait briefly for AsyncCachedImage to cache
            var uiImage: UIImage?
            for _ in 0..<15 {
                if let cached = AsyncCachedImage.cache.object(forKey: url as NSURL) {
                    uiImage = cached
                    break
                }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            if uiImage == nil {
                guard let (data, _) = try? await URLSession.shared.data(from: url),
                      let downloaded = UIImage(data: data) else { return }
                uiImage = downloaded
            }
            guard let uiImage, let cgImage = uiImage.cgImage else { return }

            let size = 40
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            var rawData = [UInt8](repeating: 0, count: size * size * 4)
            guard let context = CGContext(
                data: &rawData, width: size, height: size,
                bitsPerComponent: 8, bytesPerRow: size * 4, space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return }
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: size, height: size))

            // Find most saturated, prominent color
            var bestR: CGFloat = 0, bestG: CGFloat = 0, bestB: CGFloat = 0
            var bestScore: CGFloat = 0

            // Bucket colors
            var buckets: [String: (r: CGFloat, g: CGFloat, b: CGFloat, count: Int)] = [:]
            for i in stride(from: 0, to: size * size * 4, by: 8 * 4) {
                let r = CGFloat(rawData[i]) / 255.0
                let g = CGFloat(rawData[i + 1]) / 255.0
                let b = CGFloat(rawData[i + 2]) / 255.0

                // Skip near-white, near-black, low-alpha
                if r > 0.92 && g > 0.92 && b > 0.92 { continue }
                if r < 0.08 && g < 0.08 && b < 0.08 { continue }

                let rK = Int(r * 10) * 10
                let gK = Int(g * 10) * 10
                let bK = Int(b * 10) * 10
                let key = "\(rK),\(gK),\(bK)"
                let prev = buckets[key] ?? (r: 0, g: 0, b: 0, count: 0)
                buckets[key] = (r: prev.r + r, g: prev.g + g, b: prev.b + b, count: prev.count + 1)
            }

            for (_, bucket) in buckets {
                let n = CGFloat(bucket.count)
                let avgR = bucket.r / n, avgG = bucket.g / n, avgB = bucket.b / n

                let maxC = max(avgR, avgG, avgB)
                let minC = min(avgR, avgG, avgB)
                let delta = maxC - minC
                let lightness = (maxC + minC) / 2.0
                let saturation = delta == 0 ? 0 : delta / (1.0 - abs(2.0 * lightness - 1.0))

                // Score: prefer saturated, mid-lightness, frequent colors
                let score = saturation * 3.0 + (1.0 - abs(lightness - 0.45)) * 2.0 + log2(n + 1) * 0.5
                if score > bestScore && saturation > 0.25 && lightness > 0.15 && lightness < 0.85 {
                    bestScore = score
                    bestR = avgR; bestG = avgG; bestB = avgB
                }
            }

            if bestScore > 0 {
                let extracted = Color(red: Double(bestR), green: Double(bestG), blue: Double(bestB))
                await MainActor.run {
                    withAnimation(.easeOut(duration: 0.3)) {
                        dominantColor = extracted
                    }
                }
            }
        }
    }
}

// MARK: - Section Appear Modifier

private struct SectionAppearModifier: ViewModifier {
    let appeared: Bool
    let index: Int

    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 20)
            .animation(
                .spring(response: 0.5, dampingFraction: 0.8)
                    .delay(Double(index) * 0.08),
                value: appeared
            )
    }
}

extension View {
    fileprivate func sectionAppear(appeared: Bool, index: Int) -> some View {
        modifier(SectionAppearModifier(appeared: appeared, index: index))
    }
}
