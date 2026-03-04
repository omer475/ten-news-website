import SwiftUI

struct EventsTabView: View {
    @Environment(TabBarState.self) private var tabBarState
    @State private var viewModel = WorldEventsViewModel()
    @State private var heroImages: [String: URL] = [:]
    @State private var heroColors: [String: Color] = [:]
    @State private var followedSlugs: Set<String> = []
    @State private var selectedCategory = "Latest"
    @State private var searchText = ""

    private let eventService = WorldEventService()
    private let followKey = "followed_event_slugs"

    /// Built-in categories + dynamic topics from events
    private var categories: [String] {
        var cats = ["Latest", "Following"]
        let allTopics = Set(viewModel.events.compactMap(\.topics).flatMap { $0 })
        cats.append(contentsOf: allTopics.sorted())
        return cats
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.events.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.events.isEmpty {
                    ContentUnavailableView(
                        "No Events",
                        systemImage: "globe",
                        description: Text("World events will appear here.")
                    )
                } else {
                    eventsList
                }
            }
            .background(Color(white: 0.1))
            .navigationTitle("Events")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .navigationDestination(for: WorldEvent.self) { event in
                EventDetailView(event: event)
                    .environment(\.colorScheme, .light)
            }
            .task {
                loadFollowed()
                if viewModel.events.isEmpty {
                    await viewModel.loadEvents()
                    await loadHeroImages()
                    // Pre-download images for color extraction
                    await preloadImagesAndExtractColors()
                }
            }
        }
        .environment(\.colorScheme, .dark)
    }

    // MARK: - Follow Persistence

    private func loadFollowed() {
        let saved = UserDefaults.standard.stringArray(forKey: followKey) ?? []
        followedSlugs = Set(saved)
    }

    private func toggleFollow(_ event: WorldEvent) {
        if followedSlugs.contains(event.slug) {
            followedSlugs.remove(event.slug)
        } else {
            followedSlugs.insert(event.slug)
        }
        UserDefaults.standard.set(Array(followedSlugs), forKey: followKey)
    }

    private func isFollowed(_ event: WorldEvent) -> Bool {
        followedSlugs.contains(event.slug)
    }

    // MARK: - Load Hero Images

    private func loadHeroImages() async {
        await withTaskGroup(of: (String, URL?).self) { group in
            for event in viewModel.events {
                group.addTask {
                    do {
                        let response = try await eventService.fetchEventDetail(slug: event.slug)
                        return (event.slug, response.event?.displayImage)
                    } catch {
                        return (event.slug, nil)
                    }
                }
            }
            for await (slug, url) in group {
                if let url {
                    heroImages[slug] = url
                }
            }
        }
    }

    /// Downloads hero images and extracts dominant colors
    private func preloadImagesAndExtractColors() async {
        await withTaskGroup(of: (String, UIImage?).self) { group in
            for event in viewModel.events {
                let url = heroImages[event.slug] ?? event.displayImage
                guard let url else { continue }
                group.addTask {
                    // Check cache first
                    if let cached = AsyncCachedImage.cache.object(forKey: url as NSURL) {
                        return (event.slug, cached)
                    }
                    // Download
                    do {
                        let (data, _) = try await URLSession.shared.data(from: url)
                        if let img = UIImage(data: data) {
                            AsyncCachedImage.cache.setObject(img, forKey: url as NSURL)
                            return (event.slug, img)
                        }
                    } catch {}
                    return (event.slug, nil)
                }
            }
            for await (slug, image) in group {
                if let image {
                    heroColors[slug] = dominantColor(from: image)
                }
            }
        }
    }

    // MARK: - Filtered Events

    /// Base filtering by search text
    private var searchFilteredEvents: [WorldEvent] {
        if searchText.isEmpty { return viewModel.events }
        let q = searchText.lowercased()
        return viewModel.events.filter {
            $0.name.lowercased().contains(q)
            || $0.topics?.contains(where: { $0.lowercased().contains(q) }) == true
            || $0.countries?.contains(where: { $0.lowercased().contains(q) }) == true
        }
    }

    /// Events filtered by selected category + search text
    private var filteredEvents: [WorldEvent] {
        let base = searchFilteredEvents
        switch selectedCategory {
        case "Latest":
            return base.sorted {
                ($0.lastArticleDate ?? .distantPast) > ($1.lastArticleDate ?? .distantPast)
            }
        case "Following":
            return base.filter { followedSlugs.contains($0.slug) }
        default:
            // Topic-based filter
            return base.filter { $0.topics?.contains(selectedCategory) == true }
        }
    }

    private var followedEvents: [WorldEvent] {
        searchFilteredEvents.filter { followedSlugs.contains($0.slug) }
    }

    private var forYouEvents: [WorldEvent] {
        filteredEvents
    }

    // MARK: - Events List

    private var eventsList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                // Search bar
                searchBar
                    .padding(.horizontal, 20)
                    .padding(.top, 4)
                    .padding(.bottom, 12)

                // Category pills
                categoryBar
                    .padding(.bottom, 16)

                // Following section (horizontal) — only when on Latest
                if selectedCategory == "Latest" && !followedEvents.isEmpty {
                    followingSection
                }

                // Events grid
                if filteredEvents.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "globe")
                            .font(.system(size: 36))
                            .foregroundStyle(.quaternary)
                        Text(selectedCategory == "Following" ? "No followed events" : "No events in this category")
                            .font(.system(size: 15))
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                } else {
                    forYouSection
                }
            }
            .padding(.bottom, 20)
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        GlassEffectContainer {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color(white: 0.5))

                TextField("Search events...", text: $searchText)
                    .font(.system(size: 15))

                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(Color(white: 0.5))
                    }
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 40)
            .glassEffect(.regular, in: Capsule())
        }
    }

    // MARK: - Category Bar

    private var categoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(categories, id: \.self) { category in
                    Button {
                        withAnimation(.smooth(duration: 0.25)) {
                            selectedCategory = category
                        }
                        HapticManager.selection()
                    } label: {
                        Text(category)
                            .font(.system(size: 14, weight: selectedCategory == category ? .bold : .medium))
                            .foregroundStyle(selectedCategory == category ? .white : Color(white: 0.6))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                selectedCategory == category
                                    ? AnyShapeStyle(Color(white: 0.25))
                                    : AnyShapeStyle(Color(white: 0.15)),
                                in: Capsule()
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Following Section

    private var followingSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Following")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 20)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(followedEvents) { event in
                        NavigationLink(value: event) {
                            followingCard(event)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
        }
        .padding(.top, 8)
        .padding(.bottom, 24)
    }

    // MARK: - Following Card (horizontal, compact)

    private func followingCard(_ event: WorldEvent) -> some View {
        let heroUrl = heroImages[event.slug] ?? event.displayImage

        return ZStack(alignment: .bottom) {
            if let imageUrl = heroUrl {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(width: 200, height: 150)
                    .clipped()
            } else {
                Rectangle()
                    .fill(Color(hex: event.blurColor ?? "#1a1a2e").gradient)
                    .frame(width: 200, height: 150)
            }

            // Glass gradient
            VStack(spacing: 0) {
                Spacer()
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .mask(
                        LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0.0),
                                .init(color: .black.opacity(0.4), location: 0.25),
                                .init(color: .black, location: 0.65),
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: 90)
            }

            // Title
            VStack(alignment: .leading, spacing: 4) {
                if let updates = event.newUpdates, updates > 0 {
                    Text("\(updates) new")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color(hex: "#ff3b30"), in: Capsule())
                }

                Text(event.name)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(titleColor(for: event))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
        .frame(width: 200, height: 150)
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    // MARK: - For You Section

    private var sectionTitle: String {
        switch selectedCategory {
        case "Latest": return "For You"
        case "Following": return "Following"
        default: return selectedCategory
        }
    }

    private var forYouSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(sectionTitle)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 20)

            LazyVStack(spacing: 20) {
                ForEach(forYouEvents) { event in
                    NavigationLink(value: event) {
                        eventCoverCard(event)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Event Title Color

    /// Returns the title color for event cards
    private func titleColor(for event: WorldEvent) -> Color {
        .white
    }

    /// Extracts dominant colors from cached hero images
    private func extractHeroColors() {
        for event in viewModel.events {
            guard let url = heroImages[event.slug] ?? event.displayImage else { continue }
            if let cached = AsyncCachedImage.cache.object(forKey: url as NSURL) {
                let color = dominantColor(from: cached)
                heroColors[event.slug] = color
            }
        }
    }

    /// Extracts the most vibrant color from the image and returns a bright, eye-catching version
    private func dominantColor(from image: UIImage) -> Color {
        guard let cgImage = image.cgImage else { return .white }

        // Sample the center portion of the image (avoid edges/overlays)
        let width = cgImage.width
        let height = cgImage.height
        let cropRect = CGRect(
            x: Int(Double(width) * 0.1),
            y: Int(Double(height) * 0.15),
            width: Int(Double(width) * 0.8),
            height: Int(Double(height) * 0.55)
        )

        guard let cropped = cgImage.cropping(to: cropRect) else { return .white }

        // Scale down for fast sampling
        let sampleSize = 30
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        var data = [UInt8](repeating: 0, count: sampleSize * sampleSize * 4)

        guard let context = CGContext(
            data: &data,
            width: sampleSize,
            height: sampleSize,
            bitsPerComponent: 8,
            bytesPerRow: sampleSize * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return .white }

        context.draw(cropped, in: CGRect(origin: .zero, size: CGSize(width: sampleSize, height: sampleSize)))

        // Collect all pixels as HSB
        struct PixelHSB {
            let h: CGFloat, s: CGFloat, b: CGFloat
        }

        var pixels: [PixelHSB] = []
        let pixelCount = sampleSize * sampleSize

        for i in 0..<pixelCount {
            let offset = i * 4
            let r = CGFloat(data[offset]) / 255.0
            let g = CGFloat(data[offset + 1]) / 255.0
            let b = CGFloat(data[offset + 2]) / 255.0

            let uiColor = UIColor(red: r, green: g, blue: b, alpha: 1)
            var h: CGFloat = 0, s: CGFloat = 0, br: CGFloat = 0, a: CGFloat = 0
            uiColor.getHue(&h, saturation: &s, brightness: &br, alpha: &a)

            // Only consider pixels with meaningful color (not too grey, not too dark/light)
            if s > 0.15 && br > 0.15 && br < 0.95 {
                pixels.append(PixelHSB(h: h, s: s, b: br))
            }
        }

        guard !pixels.isEmpty else {
            // Fallback: no colorful pixels found — return a bright white
            return .white
        }

        // Sort by saturation (most vivid first) and take top 25%
        let sorted = pixels.sorted { $0.s > $1.s }
        let topCount = max(sorted.count / 4, 1)
        let topPixels = Array(sorted.prefix(topCount))

        // Average the hue of the most saturated pixels (use circular mean for hue)
        var sinSum: CGFloat = 0, cosSum: CGFloat = 0
        var satSum: CGFloat = 0

        for p in topPixels {
            let angle = p.h * 2 * .pi
            sinSum += sin(angle)
            cosSum += cos(angle)
            satSum += p.s
        }

        var avgHue = atan2(sinSum, cosSum) / (2 * .pi)
        if avgHue < 0 { avgHue += 1.0 }
        let avgSat = satSum / CGFloat(topPixels.count)

        // Create a deep, rich jewel-tone color — dark enough to read on glass overlay
        let vibrant = UIColor(
            hue: avgHue,
            saturation: min(max(avgSat * 1.3, 0.8), 1.0),  // Very saturated: 80-100%
            brightness: 0.4,                                 // Dark jewel tone
            alpha: 1.0
        )
        return Color(vibrant)
    }

    // MARK: - Cover Card

    private func eventCoverCard(_ event: WorldEvent) -> some View {
        let heroUrl = heroImages[event.slug] ?? event.displayImage
        let description: String = {
            if let bg = event.background, !bg.isEmpty { return String(bg.prefix(100)) }
            if let countries = event.countries, !countries.isEmpty {
                return countries.prefix(3).joined(separator: ", ")
            }
            return event.topics?.first ?? "Developing story"
        }()
        let followed = isFollowed(event)

        return ZStack(alignment: .top) {
            // Image
            if let imageUrl = heroUrl {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(maxWidth: .infinity)
                    .frame(height: 340)
                    .clipped()
            } else {
                Rectangle()
                    .fill(Color(hex: event.blurColor ?? "#1a1a2e").gradient)
                    .frame(height: 340)
            }

            // Liquid glass gradient (more opaque for better text contrast)
            VStack(spacing: 0) {
                Spacer()
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .mask(
                        LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0.0),
                                .init(color: .black.opacity(0.4), location: 0.18),
                                .init(color: .black.opacity(0.8), location: 0.4),
                                .init(color: .black, location: 0.65),
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: 180)
            }
            .frame(height: 340)

            // Subtle inner shadow at bottom for text readability
            VStack {
                Spacer()
                LinearGradient(
                    colors: [.clear, .black.opacity(0.15)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 80)
            }
            .frame(height: 340)
            .allowsHitTesting(false)

            // Top buttons
            HStack {
                // Updates badge
                if let updates = event.newUpdates, updates > 0 {
                    Text("\(updates) new")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Color(hex: "#ff3b30").opacity(0.85))
                        .clipShape(Capsule())
                }

                Spacer()

                // Follow button
                Button {
                    withAnimation(.spring(response: 0.3)) {
                        toggleFollow(event)
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: followed ? "checkmark" : "plus")
                            .font(.system(size: 11, weight: .bold))
                        Text(followed ? "Following" : "Follow")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(followed ? Color.white.opacity(0.25) : Color.black.opacity(0.25))
                    .background(.ultraThinMaterial.opacity(0.6))
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)

            // Title + description + topic pills
            VStack(alignment: .leading, spacing: 5) {
                Spacer()

                Text(event.name)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(titleColor(for: event))
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 0) {
                    Text(description)
                        .font(.system(size: 14))
                        .foregroundStyle(.white.opacity(0.7))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Spacer(minLength: 8)

                    // Topic pills (max 2)
                    if let topics = event.topics, !topics.isEmpty {
                        HStack(spacing: 6) {
                            ForEach(Array(topics.prefix(2).enumerated()), id: \.offset) { _, topic in
                                Text(topic)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.8))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(.white.opacity(0.15))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 18)
            .padding(.bottom, 18)
            .frame(height: 340)
        }
        .frame(height: 340)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: .black.opacity(0.06), radius: 10, y: 4)
    }
}

#Preview {
    EventsTabView()
}
