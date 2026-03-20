import SwiftUI
import UIKit

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

    /// Builds a concatenated `Text` where **bold** segments get `highlightColor`
    /// and normal segments get `baseColor`.
    func coloredTitle(
        size: CGFloat,
        weight: Font.Weight = .bold,
        baseColor: Color = .white,
        highlightColor: Color
    ) -> Text {
        let parts = self.components(separatedBy: "**")
        var combined = Text("")
        for (i, part) in parts.enumerated() {
            if part.isEmpty { continue }
            if i % 2 == 1 {
                combined = combined + Text(part)
                    .font(.system(size: size, weight: weight))
                    .foregroundColor(highlightColor)
            } else {
                combined = combined + Text(part)
                    .font(.system(size: size, weight: weight))
                    .foregroundColor(baseColor)
            }
        }
        return combined
    }
}

// MARK: - Color Adjustments

extension Color {
    /// Returns a vivid, bright version of this color — high saturation, high brightness
    func vivid() -> Color {
        let uiColor = UIColor(self)
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uiColor.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return Color(hue: Double(h),
                     saturation: Double(max(s, 0.6)),
                     brightness: Double(max(b, 0.85)))
    }

    /// Returns a deeper, darker version of this color — for use on light backgrounds
    func darkened() -> Color {
        let uiColor = UIColor(self)
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uiColor.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return Color(hue: Double(h),
                     saturation: Double(min(s * 1.2, 1.0)),
                     brightness: Double(min(b * 0.45, 0.5)))
    }
}

// MARK: - Category Colors (shared across all views)

enum CategoryColors {
    static func color(for category: String) -> Color {
        let colors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Soccer": "#DD6622", "Entertainment": "#CC9922",
            "Finance": "#228866", "Climate": "#339966", "Economy": "#228866",
            "Crypto": "#F7931A", "AI": "#7744BB", "NFL": "#013369",
            "NBA": "#C9082A", "Baseball": "#002D72", "F1": "#E10600",
            "US Politics": "#CC3344", "World Politics": "#3366CC",
            "AI & Tech": "#7744BB", "K-Pop & Music": "#CC9922",
            "Motorsport": "#E10600", "Combat Sports": "#DD6622",
            "Sports Events": "#DD6622", "Automotive": "#336699",
            "Gaming": "#7744BB", "Fashion": "#CC6699", "Skincare": "#CC6699",
            "Beauty": "#CC6699", "Lifestyle": "#CC9922", "Food": "#22AA66",
            "Music": "#CC9922",
        ]
        return Color(hex: colors[category] ?? "#3366CC")
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
