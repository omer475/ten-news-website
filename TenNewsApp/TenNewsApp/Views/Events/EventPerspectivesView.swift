import SwiftUI

/// Perspectives displayed as stacked glass cards with stance-colored accents.
struct EventPerspectivesView: View {
    let perspectives: [Perspective]
    var accentColor: Color = Color(hex: "#0057B7")

    @State private var expandedIndex: Int? = 0

    private func stanceConfig(_ stance: String?) -> (color: Color, label: String, icon: String) {
        switch stance?.lowercased() {
        case "supportive", "supports":
            return (Color(hex: "#059669"), "Supports", "hand.thumbsup.fill")
        case "opposed", "opposes":
            return (Color(hex: "#dc2626"), "Opposes", "hand.thumbsdown.fill")
        case "concerned":
            return (Color(hex: "#d97706"), "Concerned", "exclamationmark.triangle.fill")
        case "defensive", "defending":
            return (Color(hex: "#2563eb"), "Defending", "shield.fill")
        case "divided":
            return (Color(hex: "#7c3aed"), "Divided", "arrow.triangle.branch")
        default:
            return (Color(hex: "#6b7280"), "Neutral", "minus.circle.fill")
        }
    }

    var body: some View {
        VStack(spacing: 10) {
            ForEach(Array(perspectives.enumerated()), id: \.offset) { index, p in
                perspectiveCard(p, index: index)
            }
        }
    }

    private func perspectiveCard(_ p: Perspective, index: Int) -> some View {
        let config = stanceConfig(p.stance)
        let isExpanded = expandedIndex == index

        return Button {
            withAnimation(.spring(duration: 0.4, bounce: 0.2)) {
                expandedIndex = isExpanded ? nil : index
                HapticManager.light()
            }
        } label: {
            HStack(alignment: .top, spacing: 0) {
                // Colored stance bar
                RoundedRectangle(cornerRadius: 2)
                    .fill(config.color.gradient)
                    .frame(width: 4)
                    .padding(.vertical, 4)

                VStack(alignment: .leading, spacing: 12) {
                    // Entity header
                    HStack(spacing: 10) {
                        // Entity icon/emoji
                        if let icon = p.icon, !icon.isEmpty {
                            Text(icon)
                                .font(.system(size: 22))
                        }

                        VStack(alignment: .leading, spacing: 3) {
                            Text(p.entity ?? "")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(.primary)
                                .lineLimit(1)

                            // Stance badge
                            HStack(spacing: 4) {
                                Image(systemName: config.icon)
                                    .font(.system(size: 9))
                                Text(config.label.uppercased())
                                    .font(.system(size: 10, weight: .bold))
                                    .tracking(0.5)
                            }
                            .foregroundStyle(config.color)
                        }

                        Spacer()

                        Image(systemName: "chevron.down")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.tertiary)
                            .rotationEffect(isExpanded ? .degrees(180) : .zero)
                    }

                    // Expanded content
                    if isExpanded {
                        VStack(alignment: .leading, spacing: 14) {
                            // Position quote
                            if let position = p.position, !position.isEmpty {
                                HStack(alignment: .top, spacing: 12) {
                                    Text("\u{201C}")
                                        .font(.system(size: 36, weight: .bold))
                                        .foregroundStyle(config.color.opacity(0.4))
                                        .offset(y: -8)

                                    Text(position)
                                        .font(.system(size: 15))
                                        .italic()
                                        .foregroundStyle(.primary.opacity(0.85))
                                        .lineSpacing(6)
                                }
                            }

                            // Source context
                            if let sourceContext = p.sourceContext, !sourceContext.isEmpty {
                                HStack(spacing: 6) {
                                    Image(systemName: "quote.closing")
                                        .font(.system(size: 10))
                                        .foregroundStyle(.tertiary)
                                    Text(sourceContext)
                                        .font(.system(size: 12))
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .padding(.leading, 14)
                .padding(.trailing, 16)
                .padding(.vertical, 16)
            }
            .glassEffect(
                isExpanded
                    ? .regular.tint(config.color.opacity(0.06)).interactive()
                    : .regular.interactive(),
                in: RoundedRectangle(cornerRadius: 18)
            )
        }
        .buttonStyle(.plain)
    }
}
