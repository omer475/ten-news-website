import SwiftUI

@MainActor @Observable
final class OnboardingViewModel {
    enum Step: Int, CaseIterable {
        case welcome = 0
        case country = 1
        case countries = 2
        case topics = 3

        var title: String {
            switch self {
            case .welcome: return "Welcome to Ten News"
            case .country: return "Where are you from?"
            case .countries: return "Follow Countries"
            case .topics: return "Pick Your Topics"
            }
        }
    }

    var currentStep: Step = .welcome
    var selectedCountry: String?
    var selectedCountries: Set<String> = []
    var selectedTopics: Set<String> = []

    /// Available data
    var availableCountries: [Country] { Countries.all }
    var availableTopics: [Topic] { Topics.all }

    /// Validation
    var canProceed: Bool {
        switch currentStep {
        case .welcome:
            return true
        case .country:
            return selectedCountry != nil
        case .countries:
            return !selectedCountries.isEmpty
        case .topics:
            return selectedTopics.count >= 3
        }
    }

    var isLastStep: Bool { currentStep == .topics }

    var progress: Double {
        Double(currentStep.rawValue + 1) / Double(Step.allCases.count)
    }

    // MARK: - Actions

    func nextStep() {
        guard canProceed else { return }
        if let next = Step(rawValue: currentStep.rawValue + 1) {
            withAnimation(AppAnimations.pageTransition) {
                currentStep = next
            }
            HapticManager.selection()
        }
    }

    func previousStep() {
        if let prev = Step(rawValue: currentStep.rawValue - 1) {
            withAnimation(AppAnimations.pageTransition) {
                currentStep = prev
            }
        }
    }

    func selectCountry(_ countryId: String) {
        selectedCountry = countryId
        // Auto-add home country to followed countries
        selectedCountries.insert(countryId)
        HapticManager.selection()
    }

    func toggleCountry(_ countryId: String) {
        if selectedCountries.contains(countryId) {
            // Don't allow removing home country
            guard countryId != selectedCountry else { return }
            selectedCountries.remove(countryId)
        } else {
            selectedCountries.insert(countryId)
        }
        HapticManager.light()
    }

    func toggleTopic(_ topicId: String) {
        if selectedTopics.contains(topicId) {
            selectedTopics.remove(topicId)
        } else {
            selectedTopics.insert(topicId)
        }
        HapticManager.light()
    }

    /// Build UserPreferences from onboarding selections
    func buildPreferences() -> UserPreferences {
        UserPreferences(
            homeCountry: selectedCountry,
            followedCountries: Array(selectedCountries),
            followedTopics: Array(selectedTopics),
            onboardingCompleted: true
        )
    }
}
