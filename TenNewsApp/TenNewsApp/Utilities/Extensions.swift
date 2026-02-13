import SwiftUI

// MARK: - Color Hex Init

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Date Extensions

extension Date {
    /// Returns a human-readable relative time string (e.g., "2h ago", "3d ago")
    var timeAgo: String {
        let now = Date()
        let interval = now.timeIntervalSince(self)

        if interval < 60 {
            return "Just now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        } else if interval < 604800 {
            let days = Int(interval / 86400)
            return "\(days)d ago"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: self)
        }
    }

    /// Parses an ISO8601 date string into a Date object
    static func fromISO(_ string: String) -> Date? {
        // Try with fractional seconds first
        let flexibleFormatter = ISO8601DateFormatter()
        flexibleFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = flexibleFormatter.date(from: string) {
            return date
        }

        // Fallback without fractional seconds
        let basicFormatter = ISO8601DateFormatter()
        basicFormatter.formatOptions = [.withInternetDateTime]
        return basicFormatter.date(from: string)
    }
}

// MARK: - String Bold Parsing

extension String {
    /// Parses **bold** markers in the string and returns an AttributedString
    /// with bold segments rendered in semibold weight
    var boldParsed: AttributedString {
        var result = AttributedString()
        let parts = self.components(separatedBy: "**")

        for (index, part) in parts.enumerated() {
            var attributed = AttributedString(part)
            if index % 2 == 1 {
                // Odd indices are between ** markers, make them bold
                attributed.font = .system(.body, weight: .semibold)
            }
            result.append(attributed)
        }

        return result
    }
}

// MARK: - View Conditional Modifier

extension View {
    /// Applies a modifier conditionally
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    /// Applies a modifier conditionally with an else branch
    @ViewBuilder
    func `if`<TrueContent: View, FalseContent: View>(
        _ condition: Bool,
        then trueTransform: (Self) -> TrueContent,
        else falseTransform: (Self) -> FalseContent
    ) -> some View {
        if condition {
            trueTransform(self)
        } else {
            falseTransform(self)
        }
    }
}
