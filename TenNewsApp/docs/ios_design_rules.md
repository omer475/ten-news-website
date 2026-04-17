# iOS Design Rules

This document defines the mandatory design language, constraints, and patterns for all SwiftUI UI code in this project. Every contributor and AI agent **must** follow these rules when generating or modifying UI.

---

## 1. Platform & Framework

| Rule | Value |
|------|-------|
| Minimum deployment target | **iOS 18.0** |
| UI framework | **SwiftUI only** |
| UIKit usage | **Prohibited** in views (no `UIViewRepresentable` for blur, no `UIVisualEffectView`, no `UINavigationController`) |
| Architecture | MVVM with `@Observable`, `@MainActor` |

---

## 2. Design Language

The app must look and feel like a first-party Apple app (Settings, Music, Photos, Safari). That means:

- **System typography** via `Font.system(...)` or semantic fonts (`.title`, `.headline`, `.body`, `.caption`).
- **System spacing** via standard padding values (8, 12, 16, 20) rather than arbitrary pixel values.
- **System colors** (`Color.primary`, `.secondary`, `.accentColor`) with custom colors defined in the asset catalog.
- **SF Symbols** for all iconography.
- **Left-aligned, list-driven layouts** like Settings and Mail; avoid centered "hero" layouts unless the content demands it (e.g., an onboarding page).

---

## 3. Materials (Liquid Glass)

SwiftUI provides built-in materials that apply the correct vibrancy, blur, and tinting automatically. Use these instead of custom blur overlays.

### Allowed Materials

| Material | Use Case |
|----------|----------|
| `.ultraThinMaterial` | Overlays over vibrant images; maximum transparency |
| `.thinMaterial` | Cards floating above colorful backgrounds |
| `.regularMaterial` | Standard glass panels, modal overlays |
| `.thickMaterial` | Panels over busy backgrounds needing more opacity |
| `.ultraThickMaterial` | Near-opaque panels where blur is subtle |
| `.bar` | Navigation bars, tab bars, toolbars (via `.toolbarBackground`) |
| `.glassEffect` | iOS 26+ Liquid Glass API for interactive glass chrome |

### How to Apply

```swift
// Background material on a view
Text("Hello")
    .padding()
    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))

// Toolbar glass
.toolbarBackground(.regularMaterial, for: .navigationBar)
.toolbarBackground(.visible, for: .navigationBar)

// iOS 26+ Liquid Glass
Button("Action") { }
    .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 12))
```

### Prohibited

- **Never** use `UIVisualEffectView` via `UIViewRepresentable`.
- **Never** simulate blur with custom `CGImage` processing, Metal shaders, or stacked semi-transparent layers.
- **Never** use `.blur()` modifier as a substitute for materials on static UI chrome.

---

## 4. Navigation

### NavigationStack (Required)

All navigation must use `NavigationStack`. The legacy `NavigationView` is **prohibited**.

```swift
NavigationStack {
    List { ... }
        .navigationTitle("Settings")
}
```

### Large Title Behavior

- Use `.navigationBarTitleDisplayMode(.large)` for top-level screens.
- Use `.navigationBarTitleDisplayMode(.inline)` for detail/pushed screens.
- Content must scroll **under** the translucent navigation bar naturally; do not fight the system insets.

### Toolbar Background

When you need a visible glass navigation bar:

```swift
.toolbarBackground(.regularMaterial, for: .navigationBar)
.toolbarBackground(.visible, for: .navigationBar)
```

When the bar should start transparent and become visible on scroll (default iOS behavior), **do not** set `toolbarBackground` at all.

### Tab Bar

Use `TabView` with `.tabViewStyle(.automatic)`. Never build a custom tab bar unless you have an explicit product requirement.

---

## 5. Safe Area Rules

### When to Ignore Safe Areas

Use `.ignoresSafeArea()` **only** when:

1. A **background image or gradient** must extend edge-to-edge behind the status bar and home indicator.
2. A **material overlay** needs to blend behind the navigation bar or tab bar.
3. A **full-screen media player** or camera viewfinder.

### When NOT to Ignore Safe Areas

- **Content text, lists, buttons, and interactive elements** must always respect safe areas so they remain tappable and readable.
- Never use `.ignoresSafeArea()` on an entire `VStack` or `HStack` of interactive content.

```swift
// GOOD: background extends, content stays safe
ZStack {
    Color.blue.ignoresSafeArea()

    VStack {
        Text("Content respects safe area")
    }
}

// BAD: interactive content ignores safe areas
VStack {
    Button("Tappable") { }
}
.ignoresSafeArea() // buttons may be under notch or home bar
```

---

## 6. Component Rules

### List Rows

- Use native `List` with `Section` headers.
- Row height: let the system decide; do not hardcode `.frame(height:)` on rows.
- Disclosure indicators: use `NavigationLink` (system provides the chevron automatically).
- Swipe actions: use `.swipeActions(edge:)`.

### Cards

- Use `.background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))` or `.glassEffect()` (iOS 26+).
- System corner radius: 12 for small cards, 16-20 for large cards.
- Shadow: use `.shadow(color: .black.opacity(0.08), radius: 8, y: 4)` sparingly; prefer no shadow when material provides enough contrast.

### Buttons

- Primary actions: use `Button` with `.buttonStyle(.borderedProminent)`.
- Secondary actions: use `.buttonStyle(.bordered)`.
- Destructive actions: use `.tint(.red)`.
- Toolbar buttons: use `Button` inside `.toolbar { }`.
- Never build fully custom button chrome unless the design spec requires it.

### Text Fields

- Use `TextField` and `SecureField` with `.textFieldStyle(.roundedBorder)`.
- Group related fields inside `Form` or `List` for native grouping and insets.

---

## 7. Do / Don't

### DO

- Use `NavigationStack` for all navigation.
- Use SwiftUI `Material` types for glass/blur effects.
- Use `.toolbarBackground(.barMaterial)` for translucent bars.
- Use `.glassEffect()` for iOS 26+ Liquid Glass interactive chrome.
- Use `@Observable` for view models (not `ObservableObject`).
- Use system fonts, colors, and spacing.
- Use SF Symbols for icons.
- Let content scroll under translucent bars naturally.
- Use `List`, `Form`, `Section` for grouped content.
- Test on multiple device sizes (SE, standard, Pro Max).

### DON'T

- Use `NavigationView` (deprecated).
- Use `UIVisualEffectView` or any UIKit blur.
- Simulate blur with `.blur()` modifier on UI chrome.
- Build custom tab bars or navigation bars unless explicitly required.
- Use excessive custom shadows, gradients, or glow effects.
- Hardcode frame sizes where the system layout would suffice.
- Use `GeometryReader` as a primary layout tool (use it only when truly needed).
- Ignore safe areas on interactive content.
- Use `ObservableObject` + `@Published` (use `@Observable` macro instead).
- Add emojis or decorative unicode to production UI without explicit design approval.

---

## 8. Performance & Consistency

- **Lazy loading**: Use `LazyVStack` and `LazyHStack` inside `ScrollView` for long lists. Use `List` when you need system features (swipe, edit mode).
- **Image caching**: Always use a cached image loader (e.g., `AsyncCachedImage`) instead of raw `AsyncImage` for repeated network images.
- **Animation**: Use `withAnimation` with system curves (`.spring`, `.easeInOut`). Avoid custom `CAAnimation` or UIKit animation.
- **State management**: Keep `@State` local; use `@Observable` view models for shared state. Never put heavy logic in view `body`.
- **Previews**: Every new view must include a `#Preview` block.
- **Accessibility**: Set `.accessibilityLabel` on icon-only buttons. Use semantic fonts so Dynamic Type works.

---

## 9. When Rules Conflict with a Request

If a design request conflicts with these rules:

1. **Explain** which rule is violated and why.
2. **Propose** the closest Apple-native alternative.
3. **Only proceed** with the non-native approach if the requester explicitly overrides after understanding the trade-off.

---

*This document is the source of truth for all UI decisions. Updated: 2025.*
