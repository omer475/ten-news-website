import SwiftUI

/// Immersive event deep-dive page with Liquid Glass design.
/// This is where users go to truly understand a major ongoing story.
struct EventDetailView: View {
    let event: WorldEvent

    @State private var viewModel = EventDetailViewModel()
    @State private var accentColor: Color = Color(hex: "#0057B7")
    @State private var sectionsAppeared = false
    @State private var heroScale: CGFloat = 1.0
    @State private var backgroundExpanded = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                heroSection

                if let detail = viewModel.eventDetail {
                    contentSections(detail)
                } else if viewModel.isLoading {
                    loadingContent
                } else if let error = viewModel.errorMessage {
                    errorContent(error)
                }
            }
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .navigationBarHidden(true)
        .overlay(alignment: .top) { navigationOverlay }
        .task {
            if let hex = event.blurColor {
                accentColor = Color(hex: hex)
            }
            await viewModel.loadEvent(slug: event.slug)
            withAnimation(.spring(duration: 0.6, bounce: 0.15)) {
                sectionsAppeared = true
            }
        }
    }

    // MARK: - Navigation Overlay

    private var navigationOverlay: some View {
        HStack {
            Button {
                HapticManager.light()
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)
                    .frame(width: 38, height: 38)
                    .glassEffect(.regular.interactive(), in: Circle())
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 54)
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        ZStack(alignment: .bottomLeading) {
            // Image or gradient background
            if let imageUrl = event.displayImage {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(height: 420)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .scaleEffect(heroScale)
            } else {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [accentColor, accentColor.opacity(0.6), Color(hex: "#1d1d1f")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 420)
            }

            // Gradient fade to background
            VStack(spacing: 0) {
                Spacer()
                LinearGradient(
                    stops: [
                        .init(color: Color(.systemGroupedBackground).opacity(0.0), location: 0.0),
                        .init(color: Color(.systemGroupedBackground).opacity(0.4), location: 0.3),
                        .init(color: Color(.systemGroupedBackground).opacity(0.85), location: 0.7),
                        .init(color: Color(.systemGroupedBackground), location: 1.0),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 260)
            }

            // Title + metadata overlay
            VStack(alignment: .leading, spacing: 12) {
                // Topics/categories as glass pills
                if let topics = event.topics, !topics.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(topics.prefix(3), id: \.self) { topic in
                            Text(topic.uppercased())
                                .font(.system(size: 10, weight: .bold))
                                .tracking(0.5)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .glassEffect(.regular.interactive(), in: Capsule())
                        }
                    }
                }

                Text(event.name)
                    .font(.system(size: 32, weight: .heavy, design: .default))
                    .foregroundStyle(.primary)
                    .tracking(-0.5)
                    .lineSpacing(2)
                    .shadow(color: .black.opacity(0.1), radius: 8, y: 2)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .frame(height: 420)
    }

    // MARK: - Content Sections

    @ViewBuilder
    private func contentSections(_ detail: WorldEventFull) -> some View {
        VStack(alignment: .leading, spacing: 28) {
            // Day counter
            if let dayCounter = detail.dayCounter, let days = dayCounter.days {
                dayCounterView(days: days, label: dayCounter.label)
                    .sectionReveal(index: 0, appeared: sectionsAppeared)
            }

            // Background — collapsible, above latest development
            if let background = detail.background, !background.isEmpty {
                backgroundSection(background)
                    .sectionReveal(index: 1, appeared: sectionsAppeared)
            }

            // Latest Development (with key facts embedded inside)
            if let development = detail.latestDevelopment {
                sectionBlock(icon: "bolt.fill", title: "Latest Development", tint: Color(hex: "#ef4444")) {
                    EventLatestDevelopmentView(
                        development: development,
                        keyFacts: detail.keyFacts ?? [],
                        accentColor: accentColor
                    )
                }
                .sectionReveal(index: 2, appeared: sectionsAppeared)
            }

            // What to Watch
            if let items = detail.components?.whatToWatch, !items.isEmpty {
                sectionBlock(icon: "eye.fill", title: "What to Watch", tint: Color(hex: "#f59e0b")) {
                    EventWhatToWatchView(items: items, accentColor: accentColor)
                }
                .sectionReveal(index: 3, appeared: sectionsAppeared)
            }

            // This Week Timeline
            if let timeline = detail.timeline, !timeline.isEmpty {
                sectionBlock(icon: "newspaper.fill", title: "This Week", tint: Color(hex: "#3b82f6")) {
                    EventTimelineView(entries: timeline, accentColor: accentColor)
                }
                .sectionReveal(index: 4, appeared: sectionsAppeared)
            }

            // Data Analytics
            if let analytics = detail.components?.dataAnalytics,
               let charts = analytics.charts, !charts.isEmpty {
                sectionBlock(icon: "chart.bar.xaxis", title: "Data Analytics", tint: Color(hex: "#8b5cf6")) {
                    EventDataAnalyticsView(data: analytics, accentColor: accentColor)
                }
                .sectionReveal(index: 5, appeared: sectionsAppeared)
            }

        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 80)
    }

    // MARK: - Section Block Container

    private func sectionBlock<Content: View>(
        icon: String,
        title: String,
        tint: Color,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section header
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 28, height: 28)
                    .glassEffect(.regular.tint(tint.opacity(0.3)).interactive(), in: RoundedRectangle(cornerRadius: 8))

                Text(title)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.primary)

                Rectangle()
                    .fill(.secondary.opacity(0.2))
                    .frame(height: 1)
            }

            content()
        }
    }

    // MARK: - Day Counter

    private func dayCounterView(days: Int, label: String?) -> some View {
        HStack(spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(accentColor)
                Text("Day \(days)")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.primary)
            }

            if let label = label {
                Text("|")
                    .foregroundStyle(.tertiary)
                Text(label)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Background Section (inline expandable text)

    private func backgroundSection(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(text)
                .font(.system(size: 16))
                .foregroundStyle(.primary.opacity(0.8))
                .lineSpacing(6)
                .lineLimit(backgroundExpanded ? nil : 3)
                .multilineTextAlignment(.leading)

            Button {
                withAnimation(.spring(duration: 0.35, bounce: 0.1)) {
                    backgroundExpanded.toggle()
                    HapticManager.light()
                }
            } label: {
                Text(backgroundExpanded ? "Show less" : "Read more")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(accentColor)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Loading & Error

    private var loadingContent: some View {
        VStack(spacing: 24) {
            // Shimmer skeleton
            VStack(spacing: 16) {
                ForEach(0..<4, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 16)
                        .fill(.secondary.opacity(0.1))
                        .frame(height: 100)
                        .shimmer()
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
        }
    }

    private func errorContent(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(.orange)
            Text("Something went wrong")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.primary)
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.loadEvent(slug: event.slug) }
            } label: {
                Text("Try Again")
                    .font(.system(size: 14, weight: .semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .glassEffect(.regular.tint(accentColor.opacity(0.3)).interactive(), in: Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
}

// MARK: - Section Reveal Animation

private struct SectionRevealModifier: ViewModifier {
    let index: Int
    let appeared: Bool

    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 30)
            .scaleEffect(appeared ? 1 : 0.97, anchor: .top)
            .animation(
                .spring(duration: 0.6, bounce: 0.15)
                .delay(Double(index) * 0.08),
                value: appeared
            )
    }
}

extension View {
    func sectionReveal(index: Int, appeared: Bool) -> some View {
        modifier(SectionRevealModifier(index: index, appeared: appeared))
    }
}

#Preview {
    NavigationStack {
        EventDetailView(event: PreviewData.sampleEvent)
    }
}
