import SwiftUI

@main
struct TenNewsApp: App {
    @State private var appViewModel = AppViewModel()
    @AppStorage("settings_appearance_mode") private var appearanceMode = "dark"

    private var colorScheme: ColorScheme? {
        switch appearanceMode {
        case "light": .light
        case "dark": .dark
        default: nil // system
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appViewModel)
                .preferredColorScheme(colorScheme)
                .onAppear { appViewModel.loadState() }
        }
    }
}
