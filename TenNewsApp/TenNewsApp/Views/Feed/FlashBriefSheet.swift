import SwiftUI

struct FlashBriefSheet: View {
    let articles: [Article]
    let worldEvents: [WorldEvent]
    let timeOfDay: TimeOfDay
    var onArticleTap: ((Int) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var appeared = false
    @State private var surpriseIndex: Int?

    private var topArticles: [(index: Int, article: Article)] {
        Array(articles.enumerated().prefix(5)).map { ($0.offset, $0.element) }
    }

    private var trendingTopics: [String] {
        var topics: [String] = []
        for article in articles.prefix(20) {
            if let cats = article.topics {
                topics.append(contentsOf: cats)
            } else if let cat = article.category {
                topics.append(cat)
            }
        }
        // Deduplicate keeping order
        var seen = Set<String>()
        return topics.filter { seen.insert($0.lowercased()).inserted }.prefix(6).map { $0 }
    }

    private var dateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: Date())
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 10) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(.yellow)

                        Text("Flash Brief")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.primary)
                    }
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 10)

                    Text(dateString.uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .tracking(1.5)
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : 10)
                }
                .padding(.horizontal, 24)
                .padding(.top, 28)

                // Stats bar
                HStack(spacing: 0) {
                    briefStat(
                        value: "\(articles.count)",
                        label: "Stories",
                        icon: "newspaper.fill"
                    )
                    briefStat(
                        value: "\(worldEvents.count)",
                        label: "Events",
                        icon: "globe"
                    )
                    briefStat(
                        value: "\(trendingTopics.count)",
                        label: "Topics",
                        icon: "chart.line.uptrend.xyaxis"
                    )
                }
                .padding(.vertical, 14)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal, 24)
                .padding(.top, 20)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 15)

                // Top Headlines
                VStack(alignment: .leading, spacing: 14) {
                    Text("TOP HEADLINES")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .tracking(1.5)

                    ForEach(Array(topArticles.enumerated()), id: \.offset) { i, item in
                        Button {
                            HapticManager.light()
                            onArticleTap?(item.index)
                        } label: {
                            headlineRow(number: i + 1, article: item.article)
                        }
                        .buttonStyle(.plain)
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : CGFloat(10 + i * 5))
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 28)

                // Trending Topics
                if !trendingTopics.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("TRENDING TOPICS")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .tracking(1.5)

                        FlowLayout(spacing: 8) {
                            ForEach(trendingTopics, id: \.self) { topic in
                                Text(topic)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(.primary)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(Color(.systemGray6))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 28)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 20)
                }

                // Surprise Me button — picks a random article beyond the top 5
                Button {
                    HapticManager.light()
                    if articles.count > 5 {
                        let randomIdx = Int.random(in: 5..<articles.count)
                        onArticleTap?(randomIdx)
                    } else if !articles.isEmpty {
                        onArticleTap?(0)
                    }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "dice.fill")
                            .font(.system(size: 18))
                        Text("Surprise Me")
                            .font(.system(size: 16, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(
                        LinearGradient(
                            colors: [timeOfDay.accentColor, timeOfDay.accentColor.opacity(0.7)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
                .padding(.top, 32)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 25)

                // World Events preview
                if !worldEvents.isEmpty {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("DEVELOPING EVENTS")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .tracking(1.5)

                        ForEach(worldEvents.prefix(3)) { event in
                            eventRow(event)
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 28)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 25)
                }

                Spacer().frame(height: 40)
            }
        }
        .background(Color(.systemBackground))
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                appeared = true
            }
        }
    }

    // MARK: - Stat

    private func briefStat(value: String, label: String, icon: String) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)
            }
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Headline Row

    private func headlineRow(number: Int, article: Article) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text("\(number)")
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundStyle(timeOfDay.accentColor.opacity(0.4))
                .frame(width: 28, alignment: .trailing)

            VStack(alignment: .leading, spacing: 4) {
                Text(article.plainTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 6) {
                    if let source = article.source {
                        Text(source)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    if let category = article.category {
                        Text("·")
                            .foregroundStyle(.tertiary)
                        Text(category)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.tertiary)
                .padding(.top, 4)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .background(Color(.systemGray6).opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Event Row

    private func eventRow(_ event: WorldEvent) -> some View {
        HStack(spacing: 12) {
            if let imageUrl = event.displayImage {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(width: 48, height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(hex: event.blurColor ?? "#1a1a2e").gradient)
                    .frame(width: 48, height: 48)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(event.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.orange)
                        .frame(width: 5, height: 5)
                    Text("Developing")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                    if let updates = event.newUpdates, updates > 0 {
                        Text("· \(updates) new")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.orange)
                    }
                }
            }

            Spacer()
        }
    }
}

