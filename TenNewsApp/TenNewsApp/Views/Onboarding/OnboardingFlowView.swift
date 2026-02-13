import SwiftUI

/// Onboarding flow that guides users through country and topic selection.
/// Uses OnboardingViewModel to manage multi-step progression.
struct OnboardingFlowView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var viewModel = OnboardingViewModel()

    var body: some View {
        ZStack {
            // Background
            Theme.Colors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress bar
                progressBar

                // Step content
                TabView(selection: $viewModel.currentStep) {
                    welcomeStep.tag(OnboardingViewModel.Step.welcome)
                    countryStep.tag(OnboardingViewModel.Step.country)
                    countriesStep.tag(OnboardingViewModel.Step.countries)
                    topicsStep.tag(OnboardingViewModel.Step.topics)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(AppAnimations.pageTransition, value: viewModel.currentStep)

                // Bottom buttons
                bottomButtons
            }
        }
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Theme.Colors.separator)
                    .frame(height: 4)

                RoundedRectangle(cornerRadius: 2)
                    .fill(Theme.Colors.accent)
                    .frame(width: geo.size.width * viewModel.progress, height: 4)
                    .animation(AppAnimations.quickSpring, value: viewModel.progress)
            }
        }
        .frame(height: 4)
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.top, Theme.Spacing.md)
    }

    // MARK: - Steps

    private var welcomeStep: some View {
        VStack(spacing: Theme.Spacing.lg) {
            Spacer()
            Image(systemName: "newspaper.fill")
                .font(.system(size: 72))
                .foregroundStyle(Theme.Colors.accent)
            Text("Welcome to Ten News")
                .font(Theme.Fonts.headline())
            Text("Your personalized news feed, curated daily.")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(Theme.Spacing.lg)
    }

    private var countryStep: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Where are you from?")
                .font(Theme.Fonts.headline())
                .padding(.horizontal, Theme.Spacing.lg)

            ScrollView {
                LazyVStack(spacing: Theme.Spacing.sm) {
                    ForEach(viewModel.availableCountries) { country in
                        Button {
                            viewModel.selectCountry(country.id)
                        } label: {
                            HStack {
                                Text(country.flag)
                                    .font(.title2)
                                Text(country.name)
                                    .font(Theme.Fonts.bodyMedium())
                                    .foregroundStyle(Theme.Colors.primaryText)
                                Spacer()
                                if viewModel.selectedCountry == country.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.Colors.accent)
                                }
                            }
                            .padding(Theme.Spacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                                    .fill(viewModel.selectedCountry == country.id
                                          ? Theme.Colors.accent.opacity(0.1)
                                          : Theme.Colors.cardBackground)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Theme.Spacing.lg)
            }
        }
    }

    private var countriesStep: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Follow Countries")
                .font(Theme.Fonts.headline())
                .padding(.horizontal, Theme.Spacing.lg)

            Text("Select countries you want news from")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .padding(.horizontal, Theme.Spacing.lg)

            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: Theme.Spacing.sm) {
                    ForEach(viewModel.availableCountries) { country in
                        Button {
                            viewModel.toggleCountry(country.id)
                        } label: {
                            HStack {
                                Text(country.flag)
                                Text(country.name)
                                    .font(Theme.Fonts.captionMedium())
                                    .lineLimit(1)
                            }
                            .foregroundStyle(Theme.Colors.primaryText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity)
                            .background(
                                RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                                    .fill(viewModel.selectedCountries.contains(country.id)
                                          ? Theme.Colors.accent.opacity(0.15)
                                          : Theme.Colors.cardBackground)
                                    .stroke(viewModel.selectedCountries.contains(country.id)
                                            ? Theme.Colors.accent
                                            : Theme.Colors.separator, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Theme.Spacing.lg)
            }
        }
    }

    private var topicsStep: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Pick Your Topics")
                .font(Theme.Fonts.headline())
                .padding(.horizontal, Theme.Spacing.lg)

            Text("Choose at least 3 topics (\(viewModel.selectedTopics.count) selected)")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .padding(.horizontal, Theme.Spacing.lg)

            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: Theme.Spacing.sm) {
                    ForEach(viewModel.availableTopics) { topic in
                        Button {
                            viewModel.toggleTopic(topic.id)
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: topic.icon)
                                    .font(.system(size: 14))
                                Text(topic.name)
                                    .font(Theme.Fonts.captionMedium())
                                    .lineLimit(1)
                            }
                            .foregroundStyle(viewModel.selectedTopics.contains(topic.id)
                                             ? .white
                                             : Theme.Colors.primaryText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity)
                            .background(
                                RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                                    .fill(viewModel.selectedTopics.contains(topic.id)
                                          ? Theme.Colors.accent
                                          : Theme.Colors.cardBackground)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Theme.Spacing.lg)
            }
        }
    }

    // MARK: - Bottom Buttons

    private var bottomButtons: some View {
        HStack(spacing: Theme.Spacing.md) {
            if viewModel.currentStep != .welcome {
                Button("Back") {
                    viewModel.previousStep()
                }
                .font(Theme.Fonts.bodyMedium())
                .foregroundStyle(Theme.Colors.secondaryText)
            }

            Spacer()

            GlassCTAButton(title: viewModel.isLastStep ? "Get Started" : "Continue") {
                if viewModel.isLastStep {
                    let prefs = viewModel.buildPreferences()
                    appViewModel.completeOnboarding(with: prefs)
                } else {
                    viewModel.nextStep()
                }
            }
            .frame(width: 160)
            .opacity(viewModel.canProceed ? 1.0 : 0.5)
            .disabled(!viewModel.canProceed)
        }
        .padding(Theme.Spacing.lg)
    }
}

#Preview {
    OnboardingFlowView()
        .environment(AppViewModel())
}
