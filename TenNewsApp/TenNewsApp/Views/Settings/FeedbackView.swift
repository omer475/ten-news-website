import SwiftUI

struct FeedbackView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppViewModel.self) private var appViewModel

    @State private var message = ""
    @State private var showSentAlert = false
    @State private var isSending = false
    @FocusState private var isTextFocused: Bool

    private var canSend: Bool {
        !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Message
                TextEditor(text: $message)
                    .font(.system(size: 16))
                    .frame(minHeight: 220)
                    .padding(12)
                    .scrollContentBackground(.hidden)
                    .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
                    .focused($isTextFocused)
                    .overlay(alignment: .topLeading) {
                        if message.isEmpty {
                            Text("Tell us what's on your mind...")
                                .font(.system(size: 16))
                                .foregroundStyle(.tertiary)
                                .padding(.horizontal, 17)
                                .padding(.vertical, 20)
                                .allowsHitTesting(false)
                        }
                    }

                // Send button
                Button {
                    sendFeedback()
                } label: {
                    HStack(spacing: 8) {
                        if isSending {
                            ProgressView()
                                .tint(.green)
                        } else {
                            Image(systemName: "paperplane.fill")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        Text("Send Feedback")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .foregroundStyle(canSend ? .green : .secondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(.ultraThinMaterial, in: Capsule())
                    .overlay(Capsule().stroke(.white.opacity(0.12), lineWidth: 0.5))
                    .shadow(color: .black.opacity(0.2), radius: 12, y: 4)
                }
                .disabled(!canSend || isSending)
                .padding(.top, 8)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .background(Theme.Colors.backgroundPrimary)
        .navigationTitle("Send Feedback")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .keyboard) {
                Button("Done") { isTextFocused = false }
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .alert("Feedback Sent", isPresented: $showSentAlert) {
            Button("OK") { dismiss() }
        } message: {
            Text("Thank you for your feedback! We'll review it and get back to you if needed.")
        }
    }

    private func sendFeedback() {
        isSending = true
        let userName = appViewModel.currentUser?.displayName ?? "Guest User"
        let userEmail = appViewModel.currentUser?.email ?? "No email"
        let subject = "Today+ Feedback"
        let body = """
        User: \(userName)
        Email: \(userEmail)

        \(message)
        """

        let encodedSubject = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let encodedBody = body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let mailtoString = "mailto:info@todayplus.news?subject=\(encodedSubject)&body=\(encodedBody)"

        if let url = URL(string: mailtoString) {
            UIApplication.shared.open(url) { success in
                DispatchQueue.main.async {
                    isSending = false
                    if success {
                        showSentAlert = true
                    }
                }
            }
        } else {
            isSending = false
        }
    }
}

#Preview {
    NavigationStack {
        FeedbackView()
            .environment(AppViewModel())
    }
}
