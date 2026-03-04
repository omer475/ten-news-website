import SwiftUI

/// Greeting section — kept for API compatibility but greeting is now inline in MainFeedView.
struct GreetingPageView: View {
    let events: [WorldEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text(TimeOfDay.current.greeting)
                    .font(.largeTitle.bold())
                    .foregroundStyle(Theme.Colors.primaryText)

                Text("Here are the stories that matter right now.")
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.secondaryText)
            }
            .padding(.horizontal, Theme.Spacing.md)

            if !events.isEmpty {
                VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                    Text("WORLD EVENTS")
                        .font(Theme.Fonts.sectionLabel())
                        .foregroundStyle(Theme.Colors.secondaryText)
                        .tracking(1.5)
                        .padding(.horizontal, Theme.Spacing.md)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(events) { event in
                                EventCardView(event: event)
                            }
                        }
                        .padding(.horizontal, Theme.Spacing.md)
                    }
                }
            }
        }
    }
}

#Preview {
    GreetingPageView(events: [])
}
