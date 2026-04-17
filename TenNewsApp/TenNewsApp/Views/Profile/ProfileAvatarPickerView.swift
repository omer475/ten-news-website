import SwiftUI
import PhotosUI

struct ProfileAvatarPickerView: View {
    let userName: String
    let onSelectDefault: (Int) -> Void     // avatar index 1-30
    let onSelectPhoto: (UIImage) -> Void   // custom photo from library
    let onResetToInitial: () -> Void       // first-letter default
    let onDismiss: () -> Void

    // nil = nothing selected, 0 = initial letter, 1-30 = avatar index
    @State private var pickedIndex: Int?
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var pickedImageForCrop: UIImage?
    @State private var showCropView = false

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 4)
    private let avatarCount = 43

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 24) {
                        // First letter default
                        initialLetterSection

                        // Default avatars grid
                        defaultAvatarsSection

                        // Photo library button
                        photoLibrarySection

                        Spacer().frame(height: 100)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                }

                // Bottom confirm button
                if pickedIndex != nil {
                    confirmButton
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: pickedIndex)
            .background(Theme.Colors.backgroundPrimary)
            .navigationTitle("Choose Avatar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onDismiss() }
                }
            }
        }
        .overlay {
            if let cropImage = pickedImageForCrop, showCropView {
                ProfilePhotoCropView(
                    image: cropImage,
                    onSave: { cropped in
                        onSelectPhoto(cropped)
                        showCropView = false
                        pickedImageForCrop = nil
                    },
                    onCancel: {
                        showCropView = false
                        pickedImageForCrop = nil
                    }
                )
                .ignoresSafeArea()
            }
        }
    }

    // MARK: - Confirm Button

    private var confirmButton: some View {
        Button {
            HapticManager.medium()
            if let idx = pickedIndex {
                if idx == 0 {
                    onResetToInitial()
                } else {
                    onSelectDefault(idx)
                }
            }
        } label: {
            HStack(spacing: 10) {
                // Mini preview of selected avatar
                if let idx = pickedIndex {
                    if idx == 0 {
                        letterAvatar(size: 32)
                    } else {
                        Image("avatar_\(idx)")
                            .resizable()
                            .scaledToFill()
                            .frame(width: 32, height: 32)
                            .clipShape(Circle())
                    }
                }

                Text("Set as Profile Picture")
                    .font(.system(size: 15, weight: .semibold))

                Image(systemName: "checkmark")
                    .font(.system(size: 12, weight: .bold))
            }
            .foregroundStyle(.green)
            .padding(.leading, 8)
            .padding(.trailing, 40)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(.white.opacity(0.15), lineWidth: 0.5))
            .shadow(color: .black.opacity(0.25), radius: 16, y: 6)
        }
        .buttonStyle(FloatingPillButtonStyle())
        .padding(.bottom, 40)
    }

    // MARK: - First Letter Section

    private var initialLetterSection: some View {
        VStack(spacing: 10) {
            Text("Default")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                HapticManager.light()
                pickedIndex = 0
            } label: {
                HStack(spacing: 14) {
                    letterAvatar(size: 56)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Use Initial")
                            .font(.system(size: 15, weight: .semibold))
                        Text("Show the first letter of your name")
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                    }

                    Spacer()
                }
                .padding(12)
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(pickedIndex == 0 ? Color.accentColor : .clear, lineWidth: 2.5)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func letterAvatar(size: CGFloat) -> some View {
        let initial = String(userName.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased()
        let colors: [Color] = [.blue, .purple, .pink, .orange, .teal, .indigo, .mint, .cyan]
        let colorIndex = abs(userName.hashValue) % colors.count
        return ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [colors[colorIndex], colors[colorIndex].opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(initial.isEmpty ? "?" : initial)
                .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }

    // MARK: - Default Avatars Grid

    private var defaultAvatarsSection: some View {
        VStack(spacing: 10) {
            Text("Characters")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(Array(1...avatarCount), id: \.self) { index in
                    Button {
                        HapticManager.light()
                        pickedIndex = index
                    } label: {
                        Image("avatar_\(index)")
                            .resizable()
                            .scaledToFill()
                            .frame(width: 74, height: 74)
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .stroke(pickedIndex == index ? Color.accentColor : Color(.separator),
                                            lineWidth: pickedIndex == index ? 3 : 0.5)
                            )
                            .scaleEffect(pickedIndex == index ? 1.08 : 1.0)
                            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: pickedIndex == index)
                    }
                    .buttonStyle(AvatarButtonStyle())
                }
            }
        }
    }

    // MARK: - Photo Library

    private var photoLibrarySection: some View {
        VStack(spacing: 10) {
            Text("Custom")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                HStack(spacing: 12) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.system(size: 20))
                        .frame(width: 56, height: 56)
                        .background(.fill.tertiary, in: Circle())

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Choose from Library")
                            .font(.system(size: 15, weight: .semibold))
                        Text("Pick a photo from your camera roll")
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.tertiary)
                }
                .padding(12)
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
            .onChange(of: selectedPhoto) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        pickedImageForCrop = image
                        try? await Task.sleep(for: .milliseconds(300))
                        showCropView = true
                    }
                }
            }
        }
    }
}

// MARK: - Button Styles

private struct AvatarButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.9 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

private struct FloatingPillButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.92 : 1.0)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.75), value: configuration.isPressed)
    }
}
