import SwiftUI

/// Typewriter effect text animation for splash greeting
struct TypingTextView: View {
    let fullText: String
    var typingSpeed: Double = 0.05
    var startDelay: Double = 0.3

    @State private var displayedText = ""
    @State private var currentIndex = 0
    @State private var isComplete = false

    var body: some View {
        Text(displayedText)
            .onAppear {
                startTyping()
            }
    }

    private func startTyping() {
        displayedText = ""
        currentIndex = 0
        isComplete = false

        DispatchQueue.main.asyncAfter(deadline: .now() + startDelay) {
            typeNextCharacter()
        }
    }

    private func typeNextCharacter() {
        guard currentIndex < fullText.count else {
            isComplete = true
            return
        }

        let index = fullText.index(fullText.startIndex, offsetBy: currentIndex)
        displayedText += String(fullText[index])
        currentIndex += 1

        DispatchQueue.main.asyncAfter(deadline: .now() + typingSpeed) {
            typeNextCharacter()
        }
    }
}

#Preview("Typing Text") {
    TypingTextView(fullText: "Good evening.")
        .font(.system(size: 48, weight: .bold))
        .padding()
}
