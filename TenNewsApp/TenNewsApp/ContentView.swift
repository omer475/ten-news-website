import SwiftUI

struct ContentView: View {
    var body: some View {
        MainFeedView()
    }
}

#Preview {
    ContentView()
        .environment(AppViewModel())
}
