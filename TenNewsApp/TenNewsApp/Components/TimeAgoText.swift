import SwiftUI

/// Shows relative time from ISO date string in compact format: "2h", "15m", "3d"
struct TimeAgoText: View {
    let dateString: String?

    init(_ dateString: String?) {
        self.dateString = dateString
    }

    var body: some View {
        Text(relativeTime)
            .font(Theme.Fonts.footnote())
            .foregroundStyle(Theme.Colors.secondaryText)
    }

    private var relativeTime: String {
        guard let dateString,
              let date = Date.fromISO(dateString) else {
            return ""
        }
        return date.timeAgo
    }
}

#Preview("TimeAgoText") {
    VStack(spacing: 8) {
        TimeAgoText("2024-12-15T10:30:00.000Z")
        TimeAgoText(nil)
    }
}
