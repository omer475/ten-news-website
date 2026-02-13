import SwiftUI

struct TopicSelectionView: View {
    let viewModel: OnboardingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Pick Your Topics")
                .font(.system(size: 28, weight: .bold))
                .padding(.top, Theme.Spacing.lg)

            Text("Select at least 3 topics you're interested in (\(viewModel.selectedTopics.count) selected)")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)

            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 120))], spacing: 12) {
                    ForEach(viewModel.availableTopics, id: \.id) { topic in
                        Button {
                            viewModel.toggleTopic(topic.id)
                        } label: {
                            VStack(spacing: 6) {
                                Image(systemName: topic.icon)
                                    .font(.title2)
                                Text(topic.name)
                                    .font(.system(size: 13, weight: .medium))
                                    .lineLimit(1)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 12)
                            .frame(maxWidth: .infinity)
                            .glassEffect(
                                viewModel.selectedTopics.contains(topic.id)
                                    ? .regular.tint(.blue).interactive()
                                    : .regular.interactive(),
                                in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.bottom, Theme.Spacing.lg)
            }
        }
        .padding(.horizontal, Theme.Spacing.lg)
    }
}

#Preview {
    TopicSelectionView(viewModel: OnboardingViewModel())
}
