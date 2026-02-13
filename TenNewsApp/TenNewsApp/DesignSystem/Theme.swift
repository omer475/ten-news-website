import SwiftUI

enum Theme {

    // MARK: - Colors

    enum Colors {
        static let primaryText = Color(hex: "#1d1d1f")
        static let secondaryText = Color(hex: "#86868b")
        static let tertiaryText = Color(hex: "#aeaeb2")
        static let bodyText = Color(hex: "#1d1d1f").opacity(0.85)

        static let accent = Color(hex: "#007AFF")

        static let backgroundPrimary = Color(hex: "#F8F9FB")
        static let backgroundSecondary = Color(hex: "#f5f5f7")
        static let cardBackground = Color.white
        static let separator = Color(hex: "#e5e5ea")

        static let dotInactive = Color(hex: "#d1d1d6")

        static let matchTagText = Color(hex: "#007AFF")
        static let matchTagBackground = Color(hex: "#007AFF").opacity(0.1)

        static let boostText = Color(hex: "#34c759")
        static let boostBackground = Color(hex: "#34c759").opacity(0.1)

        static let destructive = Color(hex: "#FF3B30")
        static let warning = Color(hex: "#FF9500")
    }

    // MARK: - Fonts

    enum Fonts {
        static func headline() -> Font {
            .system(size: 28, weight: .bold, design: .default)
        }

        static func title() -> Font {
            .system(size: 22, weight: .bold, design: .default)
        }

        static func cardTitle() -> Font {
            .system(size: 17, weight: .bold)
        }

        static func body() -> Font {
            .system(size: 15)
        }

        static func bodyMedium() -> Font {
            .system(size: 15, weight: .medium)
        }

        static func sectionLabel() -> Font {
            .system(size: 12, weight: .semibold)
        }

        static func caption() -> Font {
            .system(size: 13)
        }

        static func captionMedium() -> Font {
            .system(size: 13, weight: .medium)
        }

        static func footnote() -> Font {
            .system(size: 11, weight: .regular)
        }
    }

    // MARK: - Spacing

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
    }

    // MARK: - Corner Radius

    enum CornerRadius {
        static let small: CGFloat = 6
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
        static let extraLarge: CGFloat = 24
    }

    // MARK: - Shadows

    enum Shadows {
        static let cardShadowColor = Color.black.opacity(0.06)
        static let cardShadowRadius: CGFloat = 8
        static let cardShadowY: CGFloat = 2
    }
}
