import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import AVKit
import UIKit

struct ProviderMessagesView: View {
    @EnvironmentObject private var providerStore: ProviderDataStore
    @Environment(\.openURL) private var openURL
    @AppStorage("providerBlockedThreads") private var blockedThreadsCSV = ""

    private var statusSubtitle: String {
        let unread = providerStore.unreadMessagesCount
        if unread == 0 { return "All caught up" }
        return "\(unread) unread message\(unread == 1 ? "" : "s")"
    }

    private var blockedThreadIDs: Set<String> {
        Set(blockedThreadsCSV.split(separator: ",").map { String($0) })
    }

    private var visibleThreads: [ProviderMessageThread] {
        providerStore.threads.filter { !blockedThreadIDs.contains($0.id) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color(hex: "090B10"), Color(hex: "10141B")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 14) {
                        ScheduleMeCard {
                            VStack(alignment: .leading, spacing: 14) {
                                HStack(alignment: .center, spacing: 12) {
                                    Circle()
                                        .fill(ScheduleMeTheme.accentSoft)
                                        .frame(width: 54, height: 54)
                                        .overlay(
                                            Image(systemName: "bubble.left.and.bubble.right.fill")
                                                .font(.system(size: 22, weight: .bold))
                                                .foregroundStyle(ScheduleMeTheme.accent)
                                        )

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Messages")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                                            .foregroundStyle(ScheduleMeTheme.titleText)
                                        Text(statusSubtitle)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                                            .foregroundStyle(ScheduleMeTheme.mutedText)
                                    }
                                }

                                HStack(spacing: 10) {
                                    HStack(spacing: 6) {
                                        Image(systemName: "tray.full")
                                            .font(.system(size: 11, weight: .semibold))
                                        Text("\(visibleThreads.count) thread\(visibleThreads.count == 1 ? "" : "s")")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    }
                                    .foregroundStyle(Color.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(ScheduleMeTheme.accent)
                                    .clipShape(Capsule())

                                    Spacer()

                                    NavigationLink {
                                        ProviderBookingsView()
                                    } label: {
                                        HStack(spacing: 6) {
                                            Image(systemName: "calendar")
                                                .font(.system(size: 11, weight: .semibold))
                                            Text("Bookings")
                                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        }
                                        .foregroundStyle(Color.white)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(ScheduleMeTheme.accent)
                                        .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }

                                HStack(spacing: 7) {
                                    Image(systemName: "shield.lefthalf.filled")
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(ScheduleMeTheme.accent)
                                    Text("Safety tools available: report, block, and support contact.")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundStyle(ScheduleMeTheme.mutedText)
                                }
                            }
                        }

                        if providerStore.isLoadingThreads && visibleThreads.isEmpty {
                            VStack(spacing: 10) {
                                ForEach(0..<4, id: \.self) { _ in
                                    ScheduleMeCard {
                                        HStack(spacing: 10) {
                                            Circle().fill(ScheduleMeTheme.surface.opacity(0.9)).frame(width: 30, height: 30)
                                            VStack(alignment: .leading, spacing: 6) {
                                                RoundedRectangle(cornerRadius: 6).fill(Color(hex: "2A2A2A")).frame(width: 128, height: 10)
                                                RoundedRectangle(cornerRadius: 6).fill(Color(hex: "2A2A2A")).frame(height: 9)
                                            }
                                        }
                                        .redacted(reason: .placeholder)
                                        .scheduleMeShimmer()
                                    }
                                }
                            }
                        } else if visibleThreads.isEmpty {
                            ScheduleMeEmptyState(
                                title: "No conversations yet",
                                message: "Customer messages will show here when bookings arrive.",
                                systemImage: "bubble.left.and.bubble.right"
                            )
                            .padding(.horizontal, 6)
                            .padding(.top, 4)
                        } else {
                            LazyVStack(spacing: 14) {
                                ForEach(visibleThreads) { thread in
                                    NavigationLink {
                                        ProviderConversationView(
                                            thread: thread,
                                            onBlock: {
                                                block(threadID: thread.id)
                                            },
                                            onReport: {
                                                report(thread)
                                            },
                                            onSupport: {
                                                support(threadID: thread.id)
                                            }
                                        )
                                    } label: {
                                        threadRow(thread)
                                    }
                                    .buttonStyle(.plain)
                                    .contextMenu {
                                        Button {
                                            report(thread)
                                        } label: {
                                            Label("Report Conversation", systemImage: "exclamationmark.bubble")
                                        }
                                        Button(role: .destructive) {
                                            block(threadID: thread.id)
                                        } label: {
                                            Label("Block Conversation", systemImage: "hand.raised")
                                        }
                                        Button {
                                            support(threadID: thread.id)
                                        } label: {
                                            Label("Contact Support", systemImage: "envelope")
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                }
            }
            .navigationTitle("Messages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    ScheduleMeWordmark(size: 24)
                }
            }
            .refreshable {
                await providerStore.loadThreads()
            }
            .task {
                if providerStore.threads.isEmpty {
                    await providerStore.loadThreads()
                }
            }
        }
    }

    private func threadRow(_ thread: ProviderMessageThread) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(ScheduleMeTheme.accentSoft)
                .frame(width: 34, height: 34)
                .overlay(
                    Text(String((thread.profile?.displayName ?? "C").prefix(1)).uppercased())
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(thread.profile?.displayName ?? "Customer")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                Text(thread.lastMessage?.content ?? thread.service)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text((thread.lastMessage?.createdAt ?? thread.createdAt).formatted(date: .abbreviated, time: .shortened))
                    .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)

                if thread.unreadCount > 0 {
                    Text("\(thread.unreadCount)")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.bold))
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(ScheduleMeTheme.accent)
                        .clipShape(Capsule())
                }
            }
        }
        .contentShape(Rectangle())
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(ScheduleMeTheme.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(ScheduleMeTheme.cardBorder)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func block(threadID: String) {
        var updated = blockedThreadIDs
        updated.insert(threadID)
        blockedThreadsCSV = updated.sorted().joined(separator: ",")
    }

    private func report(_ thread: ProviderMessageThread) {
        let subject = "Report Conversation \(thread.id)"
        let body = "Please review this thread for abusive/offensive content.\nThread ID: \(thread.id)\nCustomer: \(thread.profile?.displayName ?? "Unknown")"
        openSupportMail(subject: subject, body: body)
    }

    private func support(threadID: String) {
        openSupportMail(subject: "Provider Support", body: "I need help with conversation ID: \(threadID)")
    }

    private func openSupportMail(subject: String, body: String) {
        let supportAddress = "support@usescheduleme.com"
        let encodedSubject = subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? subject
        let encodedBody = body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? body
        if let mailURL = URL(string: "mailto:\(supportAddress)?subject=\(encodedSubject)&body=\(encodedBody)") {
            openURL(mailURL)
        }
    }
}

private struct ProviderConversationView: View {
    @EnvironmentObject private var providerStore: ProviderDataStore
    @Environment(\.dismiss) private var dismiss

    let thread: ProviderMessageThread
    let onBlock: () -> Void
    let onReport: () -> Void
    let onSupport: () -> Void

    @State private var draft = ""
    @State private var sendError: String?
    @State private var isLoadingMessages = false
    @State private var attachmentItem: PhotosPickerItem?
    @State private var showingPhotoPicker = false
    @State private var showingCameraPicker = false
    @State private var capturedImage: UIImage?
    @State private var isUploadingAttachment = false
    @State private var fullscreenMediaURL: URL?
    @State private var fullscreenMediaType: String = "image"
    @State private var showingFullscreenMedia = false

    private var conversationID: String { thread.id }

    private var fallbackConversationID: String? {
        guard let bookingID = thread.bookingID, bookingID != thread.id else { return nil }
        return thread.id
    }

    private var possibleConversationIDs: [String] {
        let threadKey = providerThreadKey(for: thread)
        let related = providerStore.threads
            .filter { providerThreadKey(for: $0) == threadKey }
            .flatMap { [$0.id, $0.bookingID, $0.lastMessage?.bookingID] }

        return ([thread.id, thread.bookingID, thread.lastMessage?.bookingID] + related)
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .removingDuplicates()
    }

    private var messages: [ProviderConversationMessage] {
        let primary = providerStore.messagesByThreadID[conversationID] ?? []
        let fallback = fallbackConversationID.flatMap { providerStore.messagesByThreadID[$0] } ?? []
        let additional = possibleConversationIDs.flatMap { providerStore.messagesByThreadID[$0] ?? [] }
        var deduped: [String: ProviderConversationMessage] = [:]
        for message in (primary + fallback + additional) {
            deduped[message.id] = message
        }
        return deduped.values.sorted { $0.createdAt < $1.createdAt }
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "090B10"), Color(hex: "10141B")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    GeometryReader { geometry in
                        ScrollView(showsIndicators: false) {
                            VStack(spacing: 0) {
                                Spacer(minLength: 0)
                                if isLoadingMessages && messages.isEmpty {
                                    let skeletonSizes: [(CGFloat, CGFloat)] = [
                                        (102, 30), (152, 34), (118, 30), (166, 36), (92, 30), (144, 34)
                                    ]
                                    LazyVStack(spacing: 8) {
                                        ForEach(Array(skeletonSizes.enumerated()), id: \.offset) { idx, item in
                                            HStack {
                                                if idx % 2 == 0 { Spacer() }
                                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                                    .fill(idx % 2 == 0 ? ScheduleMeTheme.accent.opacity(0.88) : ScheduleMeTheme.surface.opacity(0.96))
                                                    .frame(width: item.0, height: item.1)
                                                    .redacted(reason: .placeholder)
                                                    .scheduleMeShimmer()
                                                if idx % 2 != 0 { Spacer() }
                                            }
                                        }
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.bottom, 8)
                                } else if messages.isEmpty {
                                    VStack(spacing: 8) {
                                        Text("No messages yet")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                                            .foregroundStyle(ScheduleMeTheme.titleText)
                                        Text(providerStore.errorMessage ?? "Start the conversation with this customer.")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                            .foregroundStyle(ScheduleMeTheme.mutedText)
                                            .multilineTextAlignment(.center)
                                    }
                                    .padding(.horizontal, 20)
                                    .padding(.bottom, 12)
                                } else {
                                    LazyVStack(spacing: 8) {
                                        ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                                            VStack(spacing: 8) {
                                                if shouldShowTimestamp(for: index, in: messages) {
                                                    messageGroupTimestamp(for: message)
                                                }

                                                HStack {
                                                    if message.isBusinessMessage { Spacer() }
                                                    messageBubble(message)
                                                    if !message.isBusinessMessage { Spacer() }
                                                }
                                                .id(message.id)
                                            }
                                        }
                                    }
                                    .padding(12)
                                }
                            }
                            .frame(minHeight: geometry.size.height, alignment: .bottom)
                        }
                    }
                    .onChange(of: messages.count) { _, _ in
                        if let last = messages.last {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                    .task {
                        isLoadingMessages = true
                        await providerStore.loadMessages(threadID: conversationID)
                        for id in possibleConversationIDs {
                            _ = try? await providerStore.markMessagesRead(threadID: id)
                        }
                        isLoadingMessages = false

                        while !Task.isCancelled {
                            try? await Task.sleep(for: .seconds(5))
                            await providerStore.loadMessages(threadID: conversationID)
                        }
                    }
                }

                if let sendError {
                    Text(sendError)
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundStyle(.red)
                        .padding(.horizontal, 12)
                        .padding(.bottom, 6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                HStack(spacing: 8) {
                    TextField("Message customer...", text: $draft)
                        .modifier(ScheduleMeFieldModifier())
                        .scheduleMePasteMenu($draft)

                    Menu {
                        Button {
                            showingPhotoPicker = true
                        } label: {
                            Label("Photo Library", systemImage: "photo")
                        }
                        Button {
                            showingCameraPicker = true
                        } label: {
                            Label("Camera", systemImage: "camera")
                        }
                    } label: {
                        Image(systemName: "paperclip")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.white)
                            .frame(width: 40, height: 40)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                    }
                    .disabled(isUploadingAttachment)

                    Button {
                        Task { await send() }
                    } label: {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.white)
                            .frame(width: 42, height: 42)
                            .background(ScheduleMeTheme.accent)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isUploadingAttachment)
                    .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isUploadingAttachment ? 0.5 : 1)
                }
                .padding(12)
                .background(ScheduleMeTheme.pageBackground)
            }
        }
        .navigationTitle(thread.profile?.displayName ?? "Conversation")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { onReport() } label: { Label("Report Conversation", systemImage: "exclamationmark.bubble") }
                    Button(role: .destructive) {
                        onBlock()
                        dismiss()
                    } label: { Label("Block Conversation", systemImage: "hand.raised") }
                    Button { onSupport() } label: { Label("Contact Support", systemImage: "envelope") }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }
            }
        }
        .onDisappear {
            Task {
                for id in possibleConversationIDs {
                    _ = try? await providerStore.markMessagesRead(threadID: id)
                }
            }
        }
        .onChange(of: attachmentItem) { _, newItem in
            guard let item = newItem else { return }
            Task {
                await sendPickedAttachment(item)
                attachmentItem = nil
            }
        }
        .onChange(of: capturedImage) { _, image in
            guard let image else { return }
            Task {
                await sendCapturedImage(image)
                capturedImage = nil
            }
        }
        .photosPicker(isPresented: $showingPhotoPicker, selection: $attachmentItem, matching: .any(of: [.images, .videos]))
        .sheet(isPresented: $showingCameraPicker) {
            ProviderCameraPicker(image: $capturedImage)
        }
        .sheet(isPresented: $showingFullscreenMedia) {
            if let url = fullscreenMediaURL {
                ProviderMediaFullscreenView(url: url, mediaType: fullscreenMediaType)
            }
        }
    }

    private func providerThreadKey(for thread: ProviderMessageThread) -> String {
        if let id = thread.profile?.id, !id.isEmpty { return "id:\(id.lowercased())" }
        if let email = thread.profile?.email, !email.isEmpty { return "email:\(email.lowercased())" }
        return "thread:\(thread.id)"
    }

    private func shouldShowTimestamp(for index: Int, in messages: [ProviderConversationMessage]) -> Bool {
        guard index > 0 else { return true }
        let previous = messages[index - 1]
        let current = messages[index]
        let calendar = Calendar.current
        if !calendar.isDate(previous.createdAt, inSameDayAs: current.createdAt) { return true }
        return current.createdAt.timeIntervalSince(previous.createdAt) > 45 * 60
    }

    @ViewBuilder
    private func messageGroupTimestamp(for message: ProviderConversationMessage) -> some View {
        Text(message.createdAt.formatted(date: .abbreviated, time: .shortened))
            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
            .foregroundStyle(ScheduleMeTheme.mutedText)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(ScheduleMeTheme.surface.opacity(0.9))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
    }

    @ViewBuilder
    private func messageBubble(_ message: ProviderConversationMessage) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let imageURL = message.imageURL, let url = URL(string: imageURL) {
                mediaPreview(url: url, message: message)
                    .onTapGesture {
                        fullscreenMediaURL = url
                        fullscreenMediaType = messageMediaType(message)
                        showingFullscreenMedia = true
                    }
            }

            if !message.content.isEmpty && message.content != "Image attachment" && message.content != "Video attachment" {
                Text(message.content)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                    .foregroundStyle(message.isBusinessMessage ? Color.white : ScheduleMeTheme.titleText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(message.isBusinessMessage ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(message.isBusinessMessage ? Color.clear : ScheduleMeTheme.cardBorder)
                    )
            }
        }
    }

    @ViewBuilder
    private func mediaPreview(url: URL, message: ProviderConversationMessage) -> some View {
        let mediaType = messageMediaType(message)
        Group {
            if mediaType == "video" {
                ZStack {
                    VideoPlayer(player: AVPlayer(url: url))
                        .disabled(true)
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.92))
                }
            } else {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        Color(hex: "1F2937")
                            .overlay(Image(systemName: "photo").foregroundStyle(Color(hex: "94A3B8")))
                    default:
                        Color(hex: "1F2937").redacted(reason: .placeholder)
                    }
                }
            }
        }
        .frame(width: 190, height: 150)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func messageMediaType(_ message: ProviderConversationMessage) -> String {
        let explicit = message.messageType?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if explicit == "video" || explicit == "image" {
            return explicit ?? "image"
        }
        if message.content == "Video attachment" {
            return "video"
        }
        return "image"
    }

    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        do {
            _ = try await providerStore.sendMessage(threadID: conversationID, content: text)
            sendError = nil
        } catch {
            sendError = error.localizedDescription
        }
    }

    private func sendPickedAttachment(_ item: PhotosPickerItem) async {
        isUploadingAttachment = true
        defer { isUploadingAttachment = false }

        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw DataStoreError.server("Could not read selected media.")
            }
            let contentType = item.supportedContentTypes.first
            let mimeType = contentType?.preferredMIMEType ?? "image/jpeg"
            let mediaType = (contentType?.conforms(to: .movie) == true) ? "video" : "image"
            let ext = mediaType == "video" ? "mp4" : "jpg"
            let fileName = "provider_msg_\(UUID().uuidString).\(ext)"
            _ = try await providerStore.sendMessageAttachment(
                threadID: conversationID,
                data: data,
                mimeType: mimeType,
                fileName: fileName,
                mediaType: mediaType
            )
        } catch {
            sendError = error.localizedDescription
        }
    }

    private func sendCapturedImage(_ image: UIImage) async {
        guard let data = image.jpegData(compressionQuality: 0.85) else {
            sendError = "Could not process captured image."
            return
        }
        isUploadingAttachment = true
        defer { isUploadingAttachment = false }

        do {
            _ = try await providerStore.sendMessageAttachment(
                threadID: conversationID,
                data: data,
                mimeType: "image/jpeg",
                fileName: "provider_camera_\(UUID().uuidString).jpg",
                mediaType: "image"
            )
        } catch {
            sendError = error.localizedDescription
        }
    }
}

private struct ProviderMediaFullscreenView: View {
    @Environment(\.dismiss) private var dismiss
    let url: URL
    let mediaType: String

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.black.ignoresSafeArea()

            Group {
                if mediaType == "video" {
                    VideoPlayer(player: AVPlayer(url: url))
                        .ignoresSafeArea()
                } else {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFit()
                        case .failure:
                            VStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle")
                                Text("Unable to load media")
                            }
                            .foregroundStyle(Color.white.opacity(0.82))
                        default:
                            ProgressView()
                                .tint(.white)
                        }
                    }
                    .padding(12)
                }
            }

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.9))
                    .padding(16)
            }
        }
        .statusBarHidden(true)
    }
}

private extension Array where Element: Hashable {
    func removingDuplicates() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

private struct ProviderCameraPicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: ProviderCameraPicker

        init(_ parent: ProviderCameraPicker) {
            self.parent = parent
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let img = info[.originalImage] as? UIImage {
                parent.image = img
            }
            picker.dismiss(animated: true)
        }
    }
}
