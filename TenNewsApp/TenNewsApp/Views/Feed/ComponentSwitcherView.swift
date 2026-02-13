import SwiftUI

/// Glass pill component switcher with morphing tab selection.
/// Uses GlassEffectContainer and glassEffectID for the smooth morph animation
/// between selected and deselected states.
struct ComponentSwitcherView: View {
    let components: [String]
    @Binding var selected: String
    @Namespace private var componentNamespace

    var body: some View {
        GlassEffectContainer {
            HStack(spacing: 2) {
                ForEach(components, id: \.self) { component in
                    Button {
                        withAnimation(AppAnimations.quickSpring) {
                            selected = component
                        }
                        HapticManager.selection()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: iconFor(component))
                                .font(.system(size: 10))
                            Text(component.capitalized)
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(selected == component ? .primary : .secondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .glassEffect(
                            selected == component
                                ? .regular.tint(.blue).interactive()
                                : .regular.interactive(),
                            in: Capsule()
                        )
                        .glassEffectID(component, in: componentNamespace)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(3)
        }
    }

    private func iconFor(_ component: String) -> String {
        switch component.lowercased() {
        case "details": return "doc.text"
        case "timeline": return "clock"
        case "graph": return "chart.line.uptrend.xyaxis"
        case "map": return "map"
        default: return "circle"
        }
    }
}

#Preview {
    struct Preview: View {
        @State var selected = "details"
        var body: some View {
            ComponentSwitcherView(
                components: ["details", "timeline", "graph"],
                selected: $selected
            )
            .padding()
        }
    }
    return Preview()
}
