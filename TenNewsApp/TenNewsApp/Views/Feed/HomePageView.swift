import SwiftUI

/// Single-screen home page with a large dominant card — World Pulse ring up top,
/// top stories below, and a bottom action bar. Clean flashcard-inspired layout.
struct HomePageView: View {
    let articles: [Article]
    let worldEvents: [WorldEvent]
    let timeOfDay: TimeOfDay
    var onArticleTap: (Int) -> Void
    var onStartReading: () -> Void
    var onSearchTap: () -> Void

    @State private var appeared = false
    @State private var pulseAnimated = false
    @State private var displayedPulse: Int = 0
    @State private var hasAnimated = false

    // MARK: - Computed

    private var pulseValue: Int {
        let articleCountScore = min(Double(articles.count), 15.0) / 15.0 * 40.0
        let avgScore: Double = {
            guard !articles.isEmpty else { return 0 }
            let total = articles.reduce(0.0) { $0 + $1.displayScore }
            return (total / Double(articles.count)) / 1000.0 * 30.0
        }()
        let uniqueCategories = Set(articles.compactMap { $0.category })
        let categoryDiversity = Double(uniqueCategories.count) / 10.0 * 15.0
        let eventScore = min(Double(worldEvents.count), 5.0) / 5.0 * 15.0
        let total = articleCountScore + avgScore + categoryDiversity + eventScore
        return Int(min(100, max(0, total)))
    }

    private var pulseLabel: String {
        let v = pulseValue
        if v >= 80 { return "Very Active" }
        if v >= 60 { return "Active" }
        if v >= 40 { return "Moderate" }
        if v >= 20 { return "Calm" }
        return "Quiet"
    }

    private var topCategories: [(String, Color)] {
        var counts: [String: Int] = [:]
        for article in articles {
            if let cat = article.category {
                counts[cat, default: 0] += 1
            }
        }
        return counts.sorted { $0.value > $1.value }
            .prefix(4)
            .map { ($0.key, categoryColor(for: $0.key)) }
    }

    private var topStories: [(index: Int, article: Article)] {
        let sorted = articles.enumerated()
            .sorted { $0.element.displayScore > $1.element.displayScore }
        return Array(sorted.prefix(4)).map { (index: $0.offset, article: $0.element) }
    }

    private var dateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: Date())
    }

    // MARK: - Body

    private var safeAreaTop: CGFloat {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.windows.first?.safeAreaInsets.top ?? 59
    }

    private var safeAreaBottom: CGFloat {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.windows.first?.safeAreaInsets.bottom ?? 34
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerSection
                .padding(.top, safeAreaTop + 8)
                .padding(.horizontal, 20)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : -8)
                .animation(AppAnimations.staggered(index: 0, baseDelay: 0.07), value: appeared)

            // Main card
            mainCard
                .padding(.top, 12)
                .padding(.horizontal, 16)
                .opacity(appeared ? 1 : 0)
                .scaleEffect(appeared ? 1 : 0.96)
                .animation(AppAnimations.staggered(index: 1, baseDelay: 0.07), value: appeared)

            Spacer(minLength: 12)

            // Bottom bar
            bottomBar
                .padding(.horizontal, 16)
                .padding(.bottom, safeAreaBottom + 4)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 16)
                .animation(AppAnimations.staggered(index: 2, baseDelay: 0.07), value: appeared)
        }
        .background(timeOfDay.backgroundGradient.ignoresSafeArea())
        .onAppear {
            guard !hasAnimated else { return }
            hasAnimated = true
            appeared = true
            startPulseAnimation()
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text(timeOfDay.greeting)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(.primary)
                Text(dateString)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: timeOfDay.emoji)
                .font(.system(size: 28))
                .foregroundStyle(timeOfDay.accentColor)
                .symbolEffect(.pulse)
        }
    }

    // MARK: - Main Card

    private var mainCard: some View {
        VStack(spacing: 0) {
            // World Pulse
            pulseSection
                .padding(.top, 20)
                .padding(.bottom, 16)

            // Separator
            HStack(spacing: 8) {
                Rectangle().fill(.primary.opacity(0.08)).frame(height: 0.5)
                Text("TOP STORIES")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.tertiary)
                    .tracking(1.5)
                    .fixedSize()
                Rectangle().fill(.primary.opacity(0.08)).frame(height: 0.5)
            }
            .padding(.horizontal, 20)

            // Stories — expand to fill remaining space
            storiesSection
                .padding(.top, 4)

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 24)
                .fill(.ultraThinMaterial)
                .shadow(color: .black.opacity(0.06), radius: 20, y: 8)
                .shadow(color: .black.opacity(0.03), radius: 4, y: 2)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24))
    }

    // MARK: - Pulse

    private var pulseSection: some View {
        VStack(spacing: 12) {
            // Ring
            ZStack {
                // Track
                Circle()
                    .stroke(
                        timeOfDay.accentColor.opacity(0.1),
                        lineWidth: 10
                    )
                    .frame(width: 110, height: 110)

                // Progress
                Circle()
                    .trim(from: 0, to: pulseAnimated ? CGFloat(pulseValue) / 100.0 : 0)
                    .stroke(
                        AngularGradient(
                            gradient: Gradient(colors: [
                                timeOfDay.accentColor.opacity(0.4),
                                timeOfDay.accentColor,
                                timeOfDay.accentColor
                            ]),
                            center: .center,
                            startAngle: .degrees(-90),
                            endAngle: .degrees(270)
                        ),
                        style: StrokeStyle(lineWidth: 10, lineCap: .round)
                    )
                    .frame(width: 110, height: 110)
                    .rotationEffect(.degrees(-90))

                // Number + label
                VStack(spacing: 1) {
                    Text("\(displayedPulse)")
                        .font(.system(size: 38, weight: .heavy, design: .rounded))
                        .foregroundStyle(.primary)
                        .contentTransition(.numericText())
                    Text(pulseLabel.uppercased())
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(timeOfDay.accentColor)
                        .tracking(1)
                }
            }

            // Category pills
            HStack(spacing: 6) {
                ForEach(topCategories, id: \.0) { category, color in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(color)
                            .frame(width: 6, height: 6)
                        Text(category)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(color.opacity(0.08))
                    .clipShape(Capsule())
                }
            }
        }
    }

    // MARK: - Stories

    private var storiesSection: some View {
        VStack(spacing: 0) {
            ForEach(Array(topStories.enumerated()), id: \.element.article.id) { i, item in
                if i > 0 {
                    Rectangle()
                        .fill(.primary.opacity(0.05))
                        .frame(height: 0.5)
                        .padding(.leading, 72)
                        .padding(.trailing, 16)
                }
                Button {
                    HapticManager.light()
                    onArticleTap(item.index)
                } label: {
                    storyRow(item: item, rank: i + 1)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func storyRow(item: (index: Int, article: Article), rank: Int) -> some View {
        HStack(spacing: 12) {
            // Rank number
            Text("\(rank)")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(timeOfDay.accentColor.opacity(0.5))
                .frame(width: 28, alignment: .center)

            // Text
            VStack(alignment: .leading, spacing: 3) {
                item.article.displayTitle.coloredTitle(
                    size: 15,
                    weight: .semibold,
                    baseColor: .white,
                    highlightColor: timeOfDay.accentColor.vivid()
                )
                .lineLimit(2)
                .multilineTextAlignment(.leading)

                HStack(spacing: 6) {
                    if let cat = item.article.category {
                        Text(cat)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(categoryColor(for: cat))
                    }
                    if item.article.source != nil {
                        Text("·")
                            .font(.system(size: 11))
                            .foregroundStyle(.quaternary)
                    }
                    if let source = item.article.source {
                        Text(source)
                            .font(.system(size: 11))
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            Spacer(minLength: 4)

            // Thumbnail
            if let imageUrl = item.article.displayImage {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        HStack(spacing: 10) {
            Button {
                HapticManager.light()
                onSearchTap()
            } label: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.primary)
                    .frame(width: 52, height: 52)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
            }
            .buttonStyle(.plain)

            Button {
                HapticManager.medium()
                onStartReading()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 12))
                    Text("Start Reading")
                        .font(.system(size: 16, weight: .semibold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(timeOfDay.accentColor.gradient)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: timeOfDay.accentColor.opacity(0.3), radius: 12, y: 4)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Helpers

    private func categoryColor(for category: String) -> Color {
        let categoryColors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
            "Climate": "#339966", "Economy": "#228866",
            "Food": "#E07020", "Fashion": "#BB44AA", "Travel": "#2299BB", "Lifestyle": "#66AA44"
        ]
        return Color(hex: categoryColors[category] ?? "#3366CC")
    }

    private func startPulseAnimation() {
        let target = pulseValue
        guard target > 0 else {
            displayedPulse = 0
            return
        }
        // Delay so the view is fully laid out
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            withAnimation(.spring(response: 1.0, dampingFraction: 0.7)) {
                pulseAnimated = true
            }
            // Count up
            let steps = min(target, 40)
            let totalDuration = 0.8
            let interval = totalDuration / Double(steps)
            for step in 0...steps {
                let value = Int(Double(target) * Double(step) / Double(steps))
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1 + interval * Double(step)) {
                    withAnimation(.easeOut(duration: interval)) {
                        displayedPulse = value
                    }
                }
            }
        }
    }
}
