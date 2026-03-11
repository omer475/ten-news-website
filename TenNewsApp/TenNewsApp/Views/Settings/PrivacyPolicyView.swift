import SwiftUI

struct PrivacyPolicyView: View {
    private let lastUpdated = "March 11, 2026"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Last updated: \(lastUpdated)")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)

                    Text("Your privacy matters to us. This policy explains how Today+ collects, uses, and protects your information.")
                        .font(.system(size: 15))
                        .foregroundStyle(.secondary)
                        .lineSpacing(3)
                }

                section(
                    number: "1",
                    title: "Information We Collect",
                    content: """
                    **Account Information**: When you create an account, we collect your name, email address, and authentication credentials.

                    **Preferences**: We store your selected countries, topics, and personalization preferences to customize your news feed.

                    **Usage Data**: We collect information about how you interact with the app, including articles you read, time spent, and features used. This helps us improve your experience.

                    **Device Information**: We collect device type, operating system version, and app version for diagnostics and compatibility purposes.
                    """
                )

                section(
                    number: "2",
                    title: "How We Use Your Information",
                    content: """
                    We use your information to:

                    • Personalize your news feed based on your interests
                    • Deliver relevant breaking news notifications
                    • Improve our recommendation algorithms
                    • Analyze usage patterns to enhance app features
                    • Provide customer support
                    • Send important service updates
                    """
                )

                section(
                    number: "3",
                    title: "Data Storage & Security",
                    content: """
                    Your data is stored on secure servers with industry-standard encryption. We use HTTPS for all data transmission and encrypt sensitive information at rest.

                    Reading history and bookmarks are stored locally on your device and synced to our servers only when you have an account.

                    We retain your data for as long as your account is active. You can request deletion at any time.
                    """
                )

                section(
                    number: "4",
                    title: "Third-Party Services",
                    content: """
                    We may use third-party services for:

                    • **Analytics**: To understand app usage and improve performance
                    • **Content Delivery**: To serve news articles and images efficiently
                    • **Authentication**: To provide secure sign-in options

                    These services have their own privacy policies and we encourage you to review them.
                    """
                )

                section(
                    number: "5",
                    title: "Your Rights",
                    content: """
                    You have the right to:

                    • **Access** your personal data
                    • **Correct** inaccurate information
                    • **Delete** your account and associated data
                    • **Export** your data in a portable format
                    • **Opt out** of personalized recommendations
                    • **Withdraw consent** at any time

                    To exercise these rights, contact us at info@todayplus.news.
                    """
                )

                section(
                    number: "6",
                    title: "Cookies & Tracking",
                    content: """
                    The Today+ app does not use browser cookies. We use minimal device identifiers for analytics purposes only. You can reset your advertising identifier in your device settings.

                    We do not sell your personal information to third parties. We do not engage in cross-app tracking.
                    """
                )

                section(
                    number: "7",
                    title: "Children's Privacy",
                    content: """
                    Today+ is not intended for children under 13. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
                    """
                )

                section(
                    number: "8",
                    title: "Changes to This Policy",
                    content: """
                    We may update this privacy policy from time to time. We will notify you of significant changes through the app or via email. Continued use of Today+ after changes constitutes acceptance of the updated policy.
                    """
                )

                section(
                    number: "9",
                    title: "Contact Us",
                    content: """
                    If you have questions or concerns about this privacy policy, please contact us:

                    **Email**: info@todayplus.news
                    **Website**: todayplus.news
                    """
                )

                Spacer().frame(height: 40)
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
        }
        .background(Theme.Colors.backgroundPrimary)
        .navigationTitle("Privacy Policy")
        .navigationBarTitleDisplayMode(.large)
    }

    private func section(number: String, title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("\(number). \(title)")
                .font(.system(size: 18, weight: .bold))

            Text(LocalizedStringKey(content))
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
                .lineSpacing(4)
        }
    }
}

#Preview {
    NavigationStack {
        PrivacyPolicyView()
    }
}
