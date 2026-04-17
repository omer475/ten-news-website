# iOS Design Rules — TenNewsApp (Today+)

## Platform & Framework
- **Target**: iOS 18+
- **Framework**: SwiftUI only — no UIKit views (UIVisualEffectView, UIViewRepresentable for UI)
- UIImage is acceptable ONLY in data/caching layers (e.g., AsyncCachedImage)

## Materials
Use SwiftUI's built-in materials for translucent surfaces:

| Material | Use For |
|---|---|
| `.ultraThinMaterial` | Overlays on images, light frosted panels |
| `.thinMaterial` | Card backgrounds, info boxes |
| `.regularMaterial` | Navigation bars, toolbars, prominent panels |
| `.glassEffect(.regular, in:)` | Interactive elements (buttons, switchers, tabs) |

```swift
// Card with material background
.background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))

// Toolbar
.toolbarBackground(.regularMaterial, for: .navigationBar)
.toolbarBackground(.visible, for: .navigationBar)
```

## Navigation
- **Always** use `NavigationStack` — never `NavigationView`
- Large titles that collapse on scroll: `.navigationBarTitleDisplayMode(.large)`
- Translucent nav bar: `.toolbarBackground(.regularMaterial, for: .navigationBar)`
- Back buttons: system default (no custom floating back buttons)
- Share: Use `ShareLink` — never `UIActivityViewController`

## Safe Areas
- Use `.ignoresSafeArea()` ONLY to let content scroll under translucent bars
- Never ignore safe areas for custom full-screen layouts
- Content padding should respect safe area insets

## Components
- **Lists**: `List { Section { } }` with `.listStyle(.insetGrouped)`
- **Cards**: `.background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))`
- **Buttons**: System `.buttonStyle(.bordered)` or `.borderedProminent`
- **Text fields**: Standard `TextField` with `.thinMaterial` background
- **Typography**: Prefer `.font(.headline)`, `.font(.body)`, `.font(.caption)` over custom sizes

## Do / Don't

### DO
- Use `NavigationStack` for all navigation
- Use SwiftUI Materials for translucent surfaces
- Use `.toolbarBackground(.regularMaterial)` for nav bars
- Use `ShareLink` for sharing
- Use system typography scales
- Use `List` with `.insetGrouped` for settings screens
- Use `.refreshable` for pull-to-refresh
- Let content scroll under translucent bars
- Use SF Symbols for icons
- Use `@Observable` for view models

### DON'T
- Don't use UIVisualEffectView or UIKit blur
- Don't create custom gradient blur overlays on images
- Don't use NavigationView
- Don't use UIActivityViewController
- Don't fake glass with custom shaders
- Don't use `.ignoresSafeArea()` for full-screen custom layouts
- Don't hardcode UIScreen.main.bounds — use GeometryReader
- Don't create custom floating navigation bars
- Don't use excessive custom shadows/gradients
- Don't override system spacing with arbitrary pixel values
