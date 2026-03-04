import SwiftUI

/// Renders bullet points with bold keyword highlighting and colored dot indicators.
/// Parses **bold** markers in text for emphasis on key terms.
struct ArticleBulletsView: View {
    let bullets: [String]
    let accentColor: Color

    private let bulletColors: [Color] = [
        Color(hex: "#007AFF"),
        Color(hex: "#34C759"),
        Color(hex: "#FF9500"),
        Color(hex: "#AF52DE"),
        Color(hex: "#FF3B30"),
        Color(hex: "#5AC8FA"),
        Color(hex: "#FF2D55"),
        Color(hex: "#FFD60A"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array(bullets.enumerated()), id: \.offset) { index, bullet in
                bulletRow(text: bullet, index: index)
            }
        }
    }

    private func bulletRow(text: String, index: Int) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // Colored dot indicator
            Circle()
                .fill(bulletColors[index % bulletColors.count])
                .frame(width: 8, height: 8)
                .padding(.top, 6)

            // Text with bold keyword highlighting
            highlightedText(text)
                .font(.system(size: 15))
                .foregroundStyle(Theme.Colors.bodyText)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Parse **bold** markdown markers into composed Text with semibold highlighting
    private func highlightedText(_ text: String) -> Text {
        let parts = text.components(separatedBy: "**")
        var result = Text("")
        for (i, part) in parts.enumerated() {
            if part.isEmpty { continue }
            if i % 2 == 1 {
                // Bold keyword
                result = result + Text(part)
                    .fontWeight(.bold)
                    .foregroundColor(Theme.Colors.primaryText)
            } else {
                result = result + Text(part)
            }
        }
        return result
    }
}

#Preview {
    ArticleBulletsView(
        bullets: [
            "**Climate summit** concludes with new binding agreements",
            "Major economies commit to **50% reduction** by 2035",
            "Developing nations receive **$100B fund** for green transition"
        ],
        accentColor: .blue
    )
    .padding()
}
