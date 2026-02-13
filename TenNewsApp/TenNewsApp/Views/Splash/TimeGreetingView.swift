import SwiftUI

/// Shows time-based greeting with typing animation effect
struct TimeGreetingView: View {
    private let timeOfDay = TimeOfDay.current

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            TypingTextView(fullText: "\(timeOfDay.greeting).")
                .font(.system(size: 42, weight: .bold))
                .foregroundStyle(Theme.Colors.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    TimeGreetingView()
        .padding()
}
