import SwiftUI

enum TimeOfDay {
    case morning    // 5:00 - 11:59
    case afternoon  // 12:00 - 16:59
    case evening    // 17:00 - 20:59
    case night      // 21:00 - 4:59

    static var current: TimeOfDay {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12:
            return .morning
        case 12..<17:
            return .afternoon
        case 17..<21:
            return .evening
        default:
            return .night
        }
    }

    var greeting: String {
        switch self {
        case .morning:
            return "Good Morning"
        case .afternoon:
            return "Good Afternoon"
        case .evening:
            return "Good Evening"
        case .night:
            return "Good Night"
        }
    }

    var emoji: String {
        switch self {
        case .morning:
            return "sunrise"
        case .afternoon:
            return "sun.max"
        case .evening:
            return "sunset"
        case .night:
            return "moon.stars"
        }
    }

    var accentColor: Color {
        switch self {
        case .morning:
            return Color(hex: "#FF9500")
        case .afternoon:
            return Color(hex: "#007AFF")
        case .evening:
            return Color(hex: "#AF52DE")
        case .night:
            return Color(hex: "#5E5CE6")
        }
    }

    var backgroundGradient: LinearGradient {
        switch self {
        case .morning:
            return LinearGradient(
                colors: [Color(hex: "#FFF3E0"), Color(hex: "#F8F9FB")],
                startPoint: .top,
                endPoint: .bottom
            )
        case .afternoon:
            return LinearGradient(
                colors: [Color(hex: "#E3F2FD"), Color(hex: "#F8F9FB")],
                startPoint: .top,
                endPoint: .bottom
            )
        case .evening:
            return LinearGradient(
                colors: [Color(hex: "#F3E5F5"), Color(hex: "#F8F9FB")],
                startPoint: .top,
                endPoint: .bottom
            )
        case .night:
            return LinearGradient(
                colors: [Color(hex: "#E8EAF6"), Color(hex: "#F8F9FB")],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}

// MARK: - View Extension

extension View {
    /// Applies the current time-of-day background gradient
    func timeOfDayBackground() -> some View {
        self.background(TimeOfDay.current.backgroundGradient)
    }
}
