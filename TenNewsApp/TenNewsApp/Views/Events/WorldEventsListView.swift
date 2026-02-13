import SwiftUI

/// Horizontal scrolling list of event cards
struct WorldEventsListView: View {
    @State private var viewModel = WorldEventsViewModel()

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            // Section header
            Text("WORLD EVENTS")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1.5)
                .padding(.horizontal, Theme.Spacing.md)

            if viewModel.isLoading {
                loadingState
            } else if viewModel.events.isEmpty {
                emptyState
            } else {
                eventsScroll
            }
        }
        .task {
            await viewModel.loadEvents()
        }
    }

    // MARK: - Events Scroll

    private var eventsScroll: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(viewModel.events) { event in
                    EventCardView(event: event)
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
        }
    }

    // MARK: - Loading State

    private var loadingState: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                        .fill(Color(hex: "#e5e5ea").opacity(0.3))
                        .frame(width: 200, height: 130)
                        .overlay {
                            LoadingDotsView()
                        }
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        Text("No events available")
            .font(Theme.Fonts.body())
            .foregroundStyle(Theme.Colors.secondaryText)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, Theme.Spacing.lg)
    }
}

#Preview {
    WorldEventsListView()
}
