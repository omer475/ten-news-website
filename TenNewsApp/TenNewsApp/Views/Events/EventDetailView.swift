import SwiftUI

/// Full event detail page with hero image, key facts, timeline, perspectives, etc.
struct EventDetailView: View {
    let event: WorldEvent

    @State private var viewModel = EventDetailViewModel()
    @Environment(\.dismiss) private var dismiss

    private var blurColor: Color {
        if let hex = event.blurColor {
            return Color(hex: hex)
        }
        return Color(hex: "#1a1a2e")
    }

    var body: some View {
        ZStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Hero section
                    heroSection

                    // Content sections
                    if let detail = viewModel.eventDetail {
                        contentSections(detail)
                    } else if viewModel.isLoading {
                        loadingContent
                    } else if let error = viewModel.errorMessage {
                        errorContent(error)
                    }
                }
            }
            .ignoresSafeArea(edges: .top)

            // Floating buttons
            VStack {
                floatingButtons
                Spacer()
            }
        }
        .task {
            await viewModel.loadEvent(slug: event.slug)
        }
    }

    // MARK: - Floating Buttons

    private var floatingButtons: some View {
        HStack {
            GlassIconButton(icon: "chevron.left") {
                dismiss()
            }
            Spacer()
            GlassIconButton(icon: "arrowshape.turn.up.right.fill") {
                shareEvent()
            }
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.top, 54)
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        ZStack(alignment: .bottomLeading) {
            // Image
            if let imageUrl = event.displayImage {
                AsyncCachedImage(url: imageUrl)
                    .frame(height: 320)
                    .clipped()
            } else {
                Rectangle()
                    .fill(blurColor.gradient)
                    .frame(height: 320)
            }

            // Gradient overlay
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.0),
                    .init(color: blurColor.opacity(0.4), location: 0.3),
                    .init(color: blurColor.opacity(0.85), location: 0.7),
                    .init(color: blurColor, location: 1.0),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 320)

            // Title and meta
            VStack(alignment: .leading, spacing: 8) {
                if let importance = event.importance {
                    HStack(spacing: 4) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 10))
                        Text("IMPORTANCE: \(Int(importance.value))/10")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(0.5)
                    }
                    .foregroundStyle(.white.opacity(0.8))
                }

                Text(event.name)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.white)
                    .lineSpacing(2)

                HStack(spacing: 12) {
                    Label(event.status.capitalized, systemImage: "circle.fill")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(event.status == "active" ? Color(hex: "#34C759") : Theme.Colors.secondaryText)

                    TimeAgoText(event.lastArticleAt)
                }
            }
            .padding(Theme.Spacing.md)
            .padding(.bottom, Theme.Spacing.sm)
        }
    }

    // MARK: - Content Sections

    @ViewBuilder
    private func contentSections(_ detail: WorldEventFull) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            // Background / Summary
            if let summary = detail.summary, !summary.isEmpty {
                summarySection(summary)
            }

            // Key facts from five_ws
            if let fiveWs = detail.fiveWs {
                keyFactsSection(fiveWs)
            }

            // Latest development
            if let developments = detail.latestDevelopments, let latest = developments.first {
                EventLatestDevelopmentView(development: latest)
            }

            // Timeline
            if let timeline = detail.timeline, !timeline.isEmpty {
                EventTimelineView(entries: timeline)
            }

            // Perspectives
            if let perspectivesData = detail.components?.perspectives,
               let perspectives = perspectivesData.perspectives, !perspectives.isEmpty {
                EventPerspectivesView(data: perspectivesData)
            }

            // Geographic impact
            if let geoData = detail.components?.geographicImpact,
               let regions = geoData.regions, !regions.isEmpty {
                EventGeographicImpactView(data: geoData)
            }

            // What to watch
            if let watchData = detail.components?.whatToWatch,
               let items = watchData.items, !items.isEmpty {
                EventWhatToWatchView(data: watchData)
            }
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.top, Theme.Spacing.lg)
        .padding(.bottom, 100)
    }

    // MARK: - Summary Section

    private func summarySection(_ summary: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("BACKGROUND")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            Text(summary)
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.bodyText)
                .lineSpacing(6)
        }
    }

    // MARK: - Key Facts

    private func keyFactsSection(_ fiveWs: FiveWs) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("KEY FACTS")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            VStack(alignment: .leading, spacing: 12) {
                keyFactRow("WHO", fiveWs.who, "person.fill")
                keyFactRow("WHAT", fiveWs.what, "doc.text.fill")
                keyFactRow("WHEN", fiveWs.when, "clock.fill")
                keyFactRow("WHERE", fiveWs.where_, "mappin.circle.fill")
                keyFactRow("WHY", fiveWs.why, "questionmark.circle.fill")
            }
            .padding(Theme.Spacing.md)
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
        }
    }

    @ViewBuilder
    private func keyFactRow(_ label: String, _ value: String?, _ icon: String) -> some View {
        if let value, !value.isEmpty {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Colors.accent)
                    .frame(width: 18)

                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.Colors.accent)
                        .tracking(0.5)
                    Text(value)
                        .font(Theme.Fonts.body())
                        .foregroundStyle(Theme.Colors.primaryText)
                }
            }
        }
    }

    // MARK: - Loading & Error

    private var loadingContent: some View {
        VStack(spacing: 16) {
            LoadingDotsView()
            Text("Loading event details...")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.xl)
    }

    private func errorContent(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundStyle(Theme.Colors.warning)
            Text(message)
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
            Button("Retry") {
                Task { await viewModel.loadEvent(slug: event.slug) }
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.xl)
    }

    // MARK: - Share

    private func shareEvent() {
        let url = URL(string: "https://tennews.ai/events/\(event.slug)")!
        let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let root = windowScene.windows.first?.rootViewController {
            root.present(activity, animated: true)
        }
    }
}

#Preview {
    EventDetailView(event: PreviewData.sampleEvent)
}
