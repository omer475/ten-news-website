import SwiftUI

struct RootView: View {
    @Environment(AppViewModel.self) private var appViewModel

    var body: some View {
        Group {
            if appViewModel.isOnboardingComplete {
                ContentView()
                    .transition(.opacity)
            } else {
                OnboardingFlowView()
                    .transition(.opacity)
            }
        }
        .animation(.smooth(duration: 0.4), value: appViewModel.isOnboardingComplete)
    }
}

#Preview {
    RootView()
        .environment(AppViewModel())
}
