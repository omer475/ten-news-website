import SwiftUI

/// Segmented tab bar with glass morphing effect
/// Uses GlassEffectContainer with .glassEffect and .glassEffectID for morph transitions
struct GlassTabBar: View {
    let tabs: [String]
    @Binding var selectedTab: Int
    @Namespace private var tabNamespace

    var body: some View {
        GlassEffectContainer {
            HStack(spacing: 4) {
                ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
                    Button {
                        withAnimation(AppAnimations.quickSpring) {
                            selectedTab = index
                        }
                        HapticManager.selection()
                    } label: {
                        Text(tab)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(selectedTab == index ? .primary : .secondary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .glassEffect(
                                selectedTab == index
                                    ? .regular.tint(.blue).interactive()
                                    : .regular.interactive(),
                                in: Capsule()
                            )
                            .glassEffectID(tab, in: tabNamespace)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(4)
        }
    }
}

#Preview("Glass Tab Bar") {
    struct PreviewWrapper: View {
        @State private var selected = 0
        var body: some View {
            GlassTabBar(tabs: ["Today", "For You"], selectedTab: $selected)
                .padding()
        }
    }
    return PreviewWrapper()
}
