import SwiftUI

/// Shows relative time from ISO date string in compact format: "2h", "15m", "3d"
struct TimeAgoText: View {
    let dateString: String?
    let color: Color?

    init(_ dateString: String?, color: Color? = nil) {
        self.dateString = dateString
        self.color = color
    }

    var body: some View {
        Text(relativeTime)
            .font(Theme.Fonts.footnote())
            .foregroundStyle(color ?? Theme.Colors.secondaryText)
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
