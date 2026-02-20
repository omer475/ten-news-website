import SwiftUI

struct ContentView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var showSettings = false
    @State private var currentPageIndex: Int = 0

    var body: some View {
        NavigationStack {
            ZStack {
                MainFeedView(currentPageIndex: $currentPageIndex)
                    .ignoresSafeArea()

                // Settings button (top-right, only on greeting page)
                if currentPageIndex == 0 {
                    VStack {
                        HStack {
                            Spacer()
                            Button {
                                showSettings = true
                                HapticManager.light()
                            } label: {
                                Image(systemName: "gearshape")
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(.primary)
                                    .frame(width: 36, height: 36)
                                    .glassEffect(.regular.interactive(), in: Circle())
                            }
                            .padding(.trailing, 16)
                            .padding(.top, 54)
                        }
                        Spacer()
                    }
                    .transition(.opacity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: WorldEvent.self) { event in
                EventDetailView(event: event)
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView(
                preferences: appViewModel.preferences,
                onSave: { prefs in
                    appViewModel.updatePreferences(prefs)
                },
                onSignOut: {
                    appViewModel.logout()
                }
            )
        }
    }
}

#Preview {
    ContentView()
        .environment(AppViewModel())
}
