import SwiftUI

struct NewChatView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @State private var searchResults: [ChatUser] = []
    @State private var isSearching = false
    @State private var chatService = ChatService.shared
    @State private var searchTask: Task<Void, Never>?

    var onConversationCreated: (ChatConversation) -> Void

    private var userId: String? { appViewModel.currentUser?.id }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search by name or email...", text: $searchText)
                        .font(.system(size: 16))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 12)

                Divider()

                // Results
                if searchText.count < 2 {
                    searchPrompt
                } else if isSearching {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if searchResults.isEmpty {
                    noResults
                } else {
                    resultsList
                }
            }
            .navigationTitle("New Message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .background(Theme.Colors.backgroundPrimary)
        }
        .onChange(of: searchText) { _, newValue in
            searchTask?.cancel()
            searchTask = Task {
                try? await Task.sleep(nanoseconds: 400_000_000) // debounce 400ms
                guard !Task.isCancelled else { return }
                await performSearch(query: newValue)
            }
        }
    }

    // MARK: - Results

    private var resultsList: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: 0) {
                ForEach(searchResults) { user in
                    Button {
                        startConversation(with: user)
                    } label: {
                        userRow(user)
                    }
                    .buttonStyle(.plain)

                    if user.id != searchResults.last?.id {
                        Divider().padding(.leading, 80)
                    }
                }
            }
        }
    }

    private func userRow(_ user: ChatUser) -> some View {
        HStack(spacing: 14) {
            if let avatarUrl = user.avatar {
                AsyncCachedImage(url: avatarUrl, contentMode: .fill)
                    .frame(width: 50, height: 50)
                    .clipShape(Circle())
            } else {
                Circle()
                    .fill(.fill.tertiary)
                    .frame(width: 50, height: 50)
                    .overlay {
                        Text(String(user.name.prefix(1)).uppercased())
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(user.name)
                    .font(.system(size: 16, weight: .semibold))
                if let email = user.email {
                    Text(email)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    // MARK: - States

    private var searchPrompt: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.2")
                .font(.system(size: 40))
                .foregroundStyle(.quaternary)
            Text("Search for people")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var noResults: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.slash")
                .font(.system(size: 40))
                .foregroundStyle(.quaternary)
            Text("No users found")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Actions

    private func performSearch(query: String) async {
        guard let uid = userId, query.count >= 2 else {
            searchResults = []
            return
        }
        isSearching = true
        searchResults = await chatService.searchUsers(query: query, currentUserId: uid)
        isSearching = false
    }

    private func startConversation(with user: ChatUser) {
        guard let uid = userId else { return }
        HapticManager.medium()

        Task {
            if let conversation = await chatService.createOrFindConversation(
                userId: uid, otherUserId: user.id
            ) {
                onConversationCreated(conversation)
            }
        }
    }
}
