import SwiftUI

@MainActor @Observable
final class OnboardingViewModel {
    enum Step: Int, CaseIterable {
        case welcome = 0
        case country = 1
        case topics = 2

        var stepNumber: Int { rawValue }
        var totalSelectionSteps: Int { 2 }
    }

    var currentStep: Step = .welcome
    var selectedCountry: String?
    var selectedCountries: Set<String> = []
    var selectedTopics: Set<String> = []
    var expandedCategory: String?

    var availableCountries: [Country] { Countries.all }
    var availableTopics: [Topic] { Topics.all }
    var availableCategories: [TopicCategory] { TopicCategories.all }

    var canProceed: Bool {
        switch currentStep {
        case .welcome:
            return true
        case .country:
            return selectedCountry != nil
        case .topics:
            return selectedTopics.count >= 3
        }
    }

    var isLastStep: Bool { currentStep == .topics }

    var selectionProgress: Double {
        guard currentStep != .welcome else { return 0 }
        return Double(currentStep.rawValue) / 2.0
    }

    // MARK: - Actions

    func nextStep() {
        guard canProceed else { return }
        if let next = Step(rawValue: currentStep.rawValue + 1) {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                currentStep = next
            }
            HapticManager.selection()
        }
    }

    func previousStep() {
        if let prev = Step(rawValue: currentStep.rawValue - 1) {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                currentStep = prev
            }
        }
    }

    func selectCountry(_ countryId: String) {
        if selectedCountry == countryId {
            selectedCountry = nil
            selectedCountries.remove(countryId)
        } else {
            selectedCountry = countryId
            selectedCountries.insert(countryId)
        }
        HapticManager.selection()
    }

    func toggleCountry(_ countryId: String) {
        if selectedCountries.contains(countryId) {
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

    func toggleCategoryExpansion(_ categoryId: String) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            expandedCategory = expandedCategory == categoryId ? nil : categoryId
        }
        HapticManager.light()
    }

    func selectAllInCategory(_ category: TopicCategory) {
        let allIds = Set(category.subtopics.map(\.id))
        if allIds.isSubset(of: selectedTopics) {
            selectedTopics.subtract(allIds)
        } else {
            selectedTopics.formUnion(allIds)
        }
        HapticManager.medium()
    }

    func selectedCountInCategory(_ category: TopicCategory) -> Int {
        category.subtopics.filter { selectedTopics.contains($0.id) }.count
    }

    /// Debug: jump to a specific step with mock data
    func debugJumpTo(_ step: Step) {
        selectedCountry = "US"
        selectedCountries = ["US", "GB", "JP"]
        selectedTopics = ["ai", "tech_industry", "science", "space", "politics"]
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
            currentStep = step
        }
    }

    func buildPreferences() -> UserPreferences {
        UserPreferences(
            homeCountry: selectedCountry,
            followedCountries: Array(selectedCountries),
            followedTopics: Array(selectedTopics),
            onboardingCompleted: true
        )
    }
}
