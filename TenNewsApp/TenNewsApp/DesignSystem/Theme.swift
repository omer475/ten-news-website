import SwiftUI

enum Theme {

    // MARK: - Colors

    enum Colors {
        static let primaryText = Color.primary
        static let secondaryText = Color.secondary
        static let tertiaryText = Color(hex: "#aeaeb2")
        static let bodyText = Color.primary.opacity(0.85)

        static let accent = Color.accentColor

        static let backgroundPrimary = Color(.systemGroupedBackground)
        static let backgroundSecondary = Color(.secondarySystemGroupedBackground)
        static let cardBackground = Color(.secondarySystemGroupedBackground)
        static let separator = Color(.separator)

        static let dotInactive = Color(hex: "#d1d1d6")

        static let matchTagText = Color.accentColor
        static let matchTagBackground = Color.accentColor.opacity(0.1)

        static let boostText = Color(hex: "#34c759")
        static let boostBackground = Color(hex: "#34c759").opacity(0.1)

        static let destructive = Color.red
        static let warning = Color.orange
    }

    // MARK: - Fonts (system dynamic type)

    enum Fonts {
        static func headline() -> Font { .title2.bold() }
        static func title() -> Font { .title3.bold() }
        static func cardTitle() -> Font { .headline }
        static func body() -> Font { .body }
        static func bodyMedium() -> Font { .body.weight(.medium) }
        static func sectionLabel() -> Font { .caption.weight(.semibold) }
        static func caption() -> Font { .caption }
        static func captionMedium() -> Font { .caption.weight(.medium) }
        static func footnote() -> Font { .footnote }
    }

    // MARK: - Spacing (system-aligned)

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
    }

    // MARK: - Corner Radius

    enum CornerRadius {
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
        static let extraLarge: CGFloat = 24
    }

    // MARK: - Card Style

    enum Cards {
        static let cornerRadius: CGFloat = 16
        static let shadowColor = Color.black.opacity(0.08)
        static let shadowRadius: CGFloat = 8
        static let shadowY: CGFloat = 2
    }
}
