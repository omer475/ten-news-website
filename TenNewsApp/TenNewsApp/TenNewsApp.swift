import SwiftUI

@main
struct TenNewsApp: App {
    @State private var appViewModel = AppViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appViewModel)
                .onAppear { appViewModel.loadState() }
        }
    }
}
