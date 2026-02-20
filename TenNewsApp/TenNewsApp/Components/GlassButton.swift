import SwiftUI

// MARK: - Glass Icon Button

/// Circular glass button for icons (back, share, settings, etc.)
struct GlassIconButton: View {
    let icon: String
    let action: () -> Void
    var size: CGFloat = 38

    var body: some View {
        Button(action: {
            HapticManager.light()
            action()
        }) {
            Image(systemName: icon)
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundStyle(.primary)
                .frame(width: size, height: size)
                .glassEffect(.regular, in: Circle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Glass CTA Button

/// Primary call-to-action button with blue-tinted glass effect
struct GlassCTAButton: View {
    let title: String
    let action: () -> Void
    var isLoading: Bool = false
    var isDisabled: Bool = false

    var body: some View {
        Button(action: {
            guard !isLoading, !isDisabled else { return }
            HapticManager.medium()
            action()
        }) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(.primary)
                        .scaleEffect(0.8)
                } else {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                }
            }
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .glassEffect(
                isDisabled
                    ? .regular.tint(.gray).interactive()
                    : .regular.tint(.blue).interactive(),
                in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
            )
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isLoading)
    }
}

// MARK: - Previews

#Preview("Glass Buttons") {
    VStack(spacing: 20) {
        HStack(spacing: 16) {
            GlassIconButton(icon: "chevron.left") {}
            GlassIconButton(icon: "arrowshape.turn.up.right.fill") {}
            GlassIconButton(icon: "gearshape.fill") {}
        }

        GlassCTAButton(title: "Get Started") {}
        GlassCTAButton(title: "Loading...", action: {}, isLoading: true)
        GlassCTAButton(title: "Disabled", action: {}, isDisabled: true)
    }
    .padding()
}
