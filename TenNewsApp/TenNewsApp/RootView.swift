import SwiftUI

struct RootView: View {
    @Environment(AppViewModel.self) private var appViewModel

    var body: some View {
        if appViewModel.isOnboardingComplete {
            ContentView()
        } else {
            OnboardingFlowView()
        }
    }
}

#Preview {
    RootView()
        .environment(AppViewModel())
}
