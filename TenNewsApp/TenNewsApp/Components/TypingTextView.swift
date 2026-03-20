import SwiftUI

/// Typewriter effect text animation for splash greeting.
/// Uses Task-based scheduling with proper cancellation on disappear.
struct TypingTextView: View {
    let fullText: String
    var typingSpeed: Double = 0.05
    var startDelay: Double = 0.3

    @State private var displayedText = ""
    @State private var typingTask: Task<Void, Never>?

    var body: some View {
        Text(displayedText)
            .onAppear { startTyping() }
            .onDisappear { typingTask?.cancel() }
    }

    private func startTyping() {
        displayedText = ""
        typingTask?.cancel()
        typingTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(startDelay * 1_000_000_000))
            for char in fullText {
                guard !Task.isCancelled else { return }
                displayedText.append(char)
                try? await Task.sleep(nanoseconds: UInt64(typingSpeed * 1_000_000_000))
            }
        }
    }
}

#Preview("Typing Text") {
    TypingTextView(fullText: "Good evening.")
        .font(.system(size: 48, weight: .bold))
        .padding()
}
