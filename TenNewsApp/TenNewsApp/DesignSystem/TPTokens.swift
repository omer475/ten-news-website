import SwiftUI

// MARK: - TodayPlus Feed Redesign — design tokens (spec §2)
//
// The redesigned feed is a LIGHT surface by design (colors are calibrated for
// the warm white background); it does not follow the system color scheme.

enum TP {

    // MARK: Colors (§2.1)

    static let bg = Color(hex: "#FCFBF8")          // warm white, never pure #FFF
    static let ink = Color(hex: "#16150F")          // headlines, primary text
    static let ink2 = Color(hex: "#5F5B51")         // body/secondary
    static let ink3 = Color(hex: "#A39E92")         // labels, timestamps, mono
    static let line = Color(hex: "#EAE6DD")         // hairlines, pill borders
    static let gold = Color(hex: "#A8802F")         // brand accent on white
    static let goldSoft = Color(hex: "#C9A464")     // ONLY on dark surfaces
    static let red = Color(hex: "#C8362F")          // breaking, negative deltas
    static let green = Color(hex: "#1E7F4F")        // positive deltas

    static let breakingDot = Color(hex: "#FF5A52")  // pulsing dot on cover kicker
    static let mapBg = Color(hex: "#0E1320")        // map card deep navy
    static let mapLand = Color(hex: "#1A2233")
    static let mapLandStroke = Color(hex: "#27314A")
    static let mapGrid = Color(hex: "#1D2536")
    static let mapText = Color(hex: "#E8EAF2")

    // MARK: Category accents (§2.2 + the 3 pipeline additions)

    static let categoryAccents: [String: Color] = [
        "WORLD":   Color(hex: "#B5443F"),
        "AI":      Color(hex: "#A8802F"),
        "ECONOMY": Color(hex: "#946A1C"),
        "TECH":    Color(hex: "#2F66D0"),
        "POLICY":  Color(hex: "#7A4FB6"),
        "MARKETS": Color(hex: "#A8802F"),
        "SCIENCE": Color(hex: "#1F8A70"),
        "ENERGY":  Color(hex: "#C25A1F"),
        "SPORTS":  Color(hex: "#2D7A31"),
        "CULTURE": Color(hex: "#B23A77"),
        "HEALTH":  Color(hex: "#0E7C86"),
    ]

    static func accent(for category: String) -> Color {
        categoryAccents[category.uppercased()] ?? gold
    }

    // MARK: Typography (§2.3)
    // Inter Tight 700/800 (+700 italic) are bundled; body uses the system
    // face and mono labels use the system mono per the spec's iOS fallbacks.

    static func headline(_ size: CGFloat) -> Font {
        .custom("InterTight-ExtraBold", size: size)
    }

    static func headlineBold(_ size: CGFloat) -> Font {
        .custom("InterTight-Bold", size: size)
    }

    static func quoteItalic(_ size: CGFloat) -> Font {
        .custom("InterTight-BoldItalic", size: size)
    }

    static func body(_ size: CGFloat = 15, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }

    static func mono(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }

    // MARK: Layout (§2.4)

    static let columnMaxWidth: CGFloat = 600
    static let hPadding: CGFloat = 16
    static let blockGap: CGFloat = 48          // vertical gap between cards/modules
    static let imageRadius: CGFloat = 22
    static let splitThumbRadius: CGFloat = 16
    static let bulletDot: CGFloat = 6
    static let bulletIndent: CGFloat = 20

    // MARK: Animation (§5 common, §7)

    /// Card entrance: fade + rise 22pt over 0.55s cubic-bezier(.2,.7,.2,1).
    static let entrance = Animation.timingCurve(0.2, 0.7, 0.2, 1, duration: 0.55)
    /// Versus ratio bar fill (1s, 150ms delay applied at call site).
    static let barFill = Animation.timingCurve(0.2, 0.7, 0.2, 1, duration: 1.0)
    /// Bookmark pop: spring-out cubic-bezier(.3,1.8,.4,1), 0.4s.
    static let bookmarkPop = Animation.timingCurve(0.3, 1.8, 0.4, 1, duration: 0.4)
}

// MARK: - Mono kicker text helper

extension Text {
    /// Mono 9.5pt +0.22em uppercase kicker styling (§5 common).
    func tpKicker(color: Color) -> some View {
        self
            .font(TP.mono(9.5, weight: .medium))
            .kerning(9.5 * 0.22)
            .foregroundStyle(color)
            .textCase(.uppercase)
            .lineLimit(1)
    }

    /// Module header label: mono 10pt +0.26em uppercase gold (§8).
    func tpModuleHeader() -> some View {
        self
            .font(TP.mono(10, weight: .medium))
            .kerning(10 * 0.26)
            .foregroundStyle(TP.gold)
            .textCase(.uppercase)
            .lineLimit(1)
    }
}

// MARK: - Number formatting (§7.2)
// Raw numbers come without separators/symbols; prefix/unit carry "$"/"B"/"%".
// Thousands separators for ≥1000; one decimal iff the target has decimals.

enum TPNumberFormat {
    static func string(for value: Double) -> String {
        let hasDecimals = value.truncatingRemainder(dividingBy: 1) != 0
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = abs(value) >= 1000
        formatter.minimumFractionDigits = hasDecimals ? 1 : 0
        formatter.maximumFractionDigits = hasDecimals ? 1 : 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}
