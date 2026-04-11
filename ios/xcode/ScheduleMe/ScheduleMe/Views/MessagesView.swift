// FILE OVERVIEW:
// Messages inbox + thread detail + composer + polling behavior.
//
// DEBUG NOTES:
// Thread loading, badge pills, and message bubble rendering are managed here.

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import UIKit
import AVKit

struct MessagesView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var appState: AppState
    @Environment(\.openURL) private var openURL
    @State private var draft = ""
    @State private var pollingTask: Task<Void, Never>?
    @State private var selectedMedia: FullscreenMediaItem?
    @State private var attachmentItem: PhotosPickerItem?
    @State private var isUploadingAttachment = false
    @State private var didInitialScroll = false
    @State private var showingSupportFallbackAlert = false
    @State private var supportFallbackMessage = ""
    private let bottomAnchor = "bottom"
    private let inputBarHeight: CGFloat = 68

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(scrolls: false) {
                ZStack {
                    if let activeThread = dataStore.activeThread {
                        messageDetailView(activeThread)
                            .transition(.move(edge: .trailing).combined(with: .opacity))
                    } else {
                        messageThreadsView
                            .transition(.move(edge: .leading).combined(with: .opacity))
                    }
                }
                .animation(.easeInOut(duration: 0.22), value: dataStore.activeThread?.id)
            }
            .toolbar(.hidden, for: .navigationBar)
            .onAppear { startPolling() }
            .onDisappear { stopPolling() }
            .onChange(of: dataStore.activeThread?.id) { _, _ in
                didInitialScroll = false
                startPolling()
            }
            .onChange(of: dataStore.isLoadingMessages) { _, loading in
                if loading == false {
                    didInitialScroll = false
                }
            }
            .alert("Contact Support", isPresented: $showingSupportFallbackAlert) {
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(supportFallbackMessage)
            }
        }
        .task {
            if let userID = appState.userID {
                await dataStore.loadThreads(for: userID)
            }
        }
        .onChange(of: appState.userID) { _, newID in
            guard let newID else { return }
            Task { await dataStore.loadThreads(for: newID) }
        }
        .onChange(of: attachmentItem) { _, newItem in
            guard let newItem else { return }
            Task { await sendPickedAttachment(newItem) }
        }
        .fullScreenCover(item: $selectedMedia) { item in
            FullscreenMediaView(item: item)
        }
    }

    // MARK: - Thread Detail

    /// Thread detail layout: header, message history, and composer.
    /// This is rendered when `dataStore.activeThread` is non-nil.
    @ViewBuilder
    private func messageDetailView(_ activeThread: MessageThread) -> some View {
        VStack(spacing: 8) {
            HStack {
                Button {
                    withAnimation(.easeInOut(duration: 0.22)) {
                        dataStore.closeActiveThread()
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .frame(width: 36, height: 36)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(Circle())
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(activeThread.title)
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Text(activeThread.service)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }
                Spacer()
                Menu {
                    Button {
                        reportThread(activeThread)
                    } label: {
                        Label("Report Conversation", systemImage: "exclamationmark.bubble")
                    }
                    Button(role: .destructive) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            dataStore.blockThread(activeThread)
                        }
                    } label: {
                        Label("Block Conversation", systemImage: "hand.raised")
                    }
                    Button {
                        contactSupport(activeThreadID: activeThread.id)
                    } label: {
                        Label("Contact Support", systemImage: "envelope")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                        .frame(width: 36, height: 36)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 10)
            .background(
                ScheduleMeTheme.creamBackground
                    .overlay(Rectangle().frame(height: 1).foregroundStyle(ScheduleMeTheme.cardBorder), alignment: .bottom)
            )

            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            if dataStore.isLoadingMessages && dataStore.messages.isEmpty {
                                MessageBubbleSkeletonStack()
                                    .padding(.top, 8)
                            } else if let messagesError = dataStore.messagesError, dataStore.messages.isEmpty {
                                ScheduleMeEmptyState(
                                    title: "Messages unavailable",
                                    message: messagesError,
                                    systemImage: "bubble.left.and.exclamationmark.bubble.right",
                                    actionTitle: "Retry",
                                    action: {
                                        Task { await dataStore.openThread(activeThread) }
                                    }
                                )
                                .padding(.top, 20)
                            } else if dataStore.messages.isEmpty {
                                ScheduleMeEmptyState(
                                    title: "No messages yet",
                                    message: "Send a message to start this conversation.",
                                    systemImage: "bubble.left.and.bubble.right"
                                )
                                .padding(.top, 20)
                            } else {
                                if dataStore.hasMoreMessages {
                                    SkeletonBlock(width: 120, height: 14, cornerRadius: 6)
                                        .frame(maxWidth: .infinity)
                                        .onAppear {
                                            Task { await dataStore.loadMoreMessages() }
                                        }
                                }
                                ForEach(Array(dataStore.messages.enumerated()), id: \.element.id) { index, message in
                                    if shouldShowTimestamp(for: index, in: dataStore.messages) {
                                        MessageTimestampDivider(
                                            text: timestampLabel(for: message.createdAt)
                                        )
                                        .padding(.vertical, 2)
                                    }
                                    MessageBubble(message: message) { item in
                                        selectedMedia = item
                                    }
                                }
                            }
                            Color.clear
                                .frame(height: 1)
                                .id(bottomAnchor)
                        }
                        .frame(maxWidth: .infinity, alignment: .bottom)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 6)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .scrollBounceBehavior(.basedOnSize)
                    .defaultScrollAnchor(.bottom)
                    .onChange(of: dataStore.isLoadingMessages) { _, loading in
                        if loading == false && didInitialScroll == false {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                                scrollToBottom(proxy, animated: false)
                                didInitialScroll = true
                            }
                        }
                    }
                    .onChange(of: dataStore.messages.count) { _, _ in
                        if dataStore.isLoadingMoreMessages { return }
                        scrollToBottom(proxy, animated: false)
                    }
                    .onChange(of: dataStore.activeThread?.id) { _, _ in
                        didInitialScroll = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            scrollToBottom(proxy, animated: false)
                        }
                    }
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            scrollToBottom(proxy, animated: false)
                        }
                    }
                    .transaction { transaction in
                        transaction.disablesAnimations = true
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .layoutPriority(1)

                messageInputBar(for: activeThread)
            }
        }
    }

    private var messageThreadsView: some View {
        VStack(spacing: 0) {
            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(ScheduleMeTheme.accentSoft)
                            .frame(width: 36, height: 36)
                            .overlay(
                                Image(systemName: "bubble.left.and.bubble.right.fill")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(ScheduleMeTheme.accent)
                            )

                        VStack(alignment: .leading, spacing: 3) {
                            Text("Messages")
                                .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                            Text(messageHeaderSubtitle)
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                        Spacer()
                    }

                    HStack(spacing: 8) {
                        Label("\(dataStore.threads.count) threads", systemImage: "tray.full")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(ScheduleMeTheme.accent)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(ScheduleMeTheme.accent))

                        Spacer()

                        Button {
                            tabRouter.selected = .bookings
                        } label: {
                            Label("Bookings", systemImage: "calendar")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(ScheduleMeTheme.accent)
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                        }
                        .buttonStyle(.plain)
                    }

                    HStack(spacing: 8) {
                        Image(systemName: "shield.lefthalf.filled")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.accent)
                        Text("Safety tools available: report, block, and support contact.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)

            VStack(alignment: .leading, spacing: 12) {
                if (!dataStore.hasLoadedThreads || dataStore.isLoadingThreads) && dataStore.threads.isEmpty {
                    ThreadListSkeleton()
                } else if let messagesError = dataStore.messagesError {
                    ScheduleMeEmptyState(
                        title: "Messages unavailable",
                        message: messagesError,
                        systemImage: "bubble.left.and.exclamationmark.bubble.right"
                    )
                } else if dataStore.threads.isEmpty {
                    ScheduleMeEmptyState(
                        title: "No messages yet",
                        message: "Once you book a service, you can message the pro directly here.",
                        systemImage: "bubble.left.and.bubble.right",
                        actionTitle: "Browse professionals",
                        action: { tabRouter.selected = .browse }
                    )
                } else {
                    ForEach(dataStore.threads) { thread in
                        Button {
                            Task { await dataStore.openThread(thread) }
                        } label: {
                            ThreadRow(thread: thread)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button {
                                reportThread(thread)
                            } label: {
                                Label("Report Conversation", systemImage: "exclamationmark.bubble")
                            }
                            Button(role: .destructive) {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    dataStore.blockThread(thread)
                                }
                            } label: {
                                Label("Block Conversation", systemImage: "hand.raised")
                            }
                            Button {
                                contactSupport(activeThreadID: thread.id)
                            } label: {
                                Label("Contact Support", systemImage: "envelope")
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 24)
        }
    }

    private var messageHeaderSubtitle: String {
        let unread = dataStore.threads.reduce(0) { $0 + max(0, $1.unreadCount) }
        if unread > 0 {
            return "\(unread) unread message\(unread == 1 ? "" : "s")"
        }
        if dataStore.threads.isEmpty {
            return "Start a booking to open a thread"
        }
        return "All caught up"
    }

    // MARK: - Composer + Scrolling

    /// Bottom composer for sending plain text messages into the active thread.
    @ViewBuilder
    private func messageInputBar(for thread: MessageThread) -> some View {
        HStack(spacing: 8) {
            TextField("Message \(thread.title)", text: $draft, axis: .vertical)
                .lineLimit(1...4)
                .scheduleMeFieldStyle()
                .foregroundColor(ScheduleMeTheme.titleText)

            HStack(spacing: 10) {
                PhotosPicker(selection: $attachmentItem, matching: .any(of: [.images, .videos])) {
                    Image(systemName: "paperclip")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .frame(width: 38, height: 38)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(Circle())
                }
                .disabled(isUploadingAttachment || dataStore.activeThread == nil)

                Button {
                    Task {
                        let message = draft
                        draft = ""
                        await dataStore.sendMessage(message)
                    }
                } label: {
                    Group {
                        if isUploadingAttachment {
                            ScheduleMeLoadingBar(
                                width: 20,
                                height: 4,
                                tint: .white,
                                track: Color.white.opacity(0.28),
                                minimumFill: 0.2
                            )
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                    .frame(width: 38, height: 38)
                    .background(ScheduleMeTheme.accent)
                    .clipShape(Circle())
                }
                .disabled(
                    draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || dataStore.isSendingMessage
                    || isUploadingAttachment
                )
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 18)
        .frame(height: inputBarHeight)
        .background(
            Rectangle()
                .fill(ScheduleMeTheme.creamBackground)
                .overlay(Rectangle().frame(height: 1).foregroundStyle(ScheduleMeTheme.cardBorder), alignment: .top)
        )
    }

    /// Forces scroll to the sentinel anchor at the latest message.
    /// Delayed dispatch avoids race conditions with SwiftUI layout updates.
    private func scrollToBottom(_ proxy: ScrollViewProxy, animated: Bool = true) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            if animated {
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(bottomAnchor, anchor: .bottom)
                }
            } else {
                proxy.scrollTo(bottomAnchor, anchor: .bottom)
            }
        }
    }

    private func shouldShowTimestamp(for index: Int, in messages: [ConversationMessage]) -> Bool {
        guard messages.indices.contains(index) else { return false }
        if index == 0 { return true }
        let previous = messages[index - 1].createdAt
        let current = messages[index].createdAt
        if !Calendar.current.isDate(previous, inSameDayAs: current) {
            return true
        }
        return current.timeIntervalSince(previous) > (20 * 60)
    }

    private func timestampLabel(for date: Date) -> String {
        if Calendar.current.isDateInToday(date) {
            return "Today \(Self.messageTimeFormatter.string(from: date))"
        }
        if Calendar.current.isDateInYesterday(date) {
            return "Yesterday \(Self.messageTimeFormatter.string(from: date))"
        }
        return "\(Self.messageDateFormatter.string(from: date)) \(Self.messageTimeFormatter.string(from: date))"
    }

    private static let messageTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "h:mm a"
        return formatter
    }()

    private static let messageDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter
    }()


    /// Polls frequently while a thread is open, and slower while only inbox is visible.
    private func startPolling() {
        pollingTask?.cancel()
        pollingTask = Task {
            while !Task.isCancelled {
                if let thread = dataStore.activeThread {
                    await dataStore.refreshActiveThreadMessages(thread: thread)
                    try? await Task.sleep(for: .seconds(4))
                } else {
                    if let userID = appState.userID {
                        await dataStore.loadThreads(for: userID)
                    }
                    try? await Task.sleep(for: .seconds(8))
                }
            }
        }
    }

    /// Cancels active polling task when view disappears.
    private func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    // MARK: - Safety / UGC Compliance

    /// Opens pre-filled support email to report abusive or offensive content.
    private func reportThread(_ thread: MessageThread) {
        openSupportPage()
    }

    /// Opens support contact route from message safety tools.
    private func contactSupport(activeThreadID: String?) {
        _ = activeThreadID // reserved for future support context passthrough
        openSupportPage()
    }

    private func openSupportPage() {
        guard let supportURL = URL(string: "https://www.usescheduleme.com/support") else {
            supportFallbackMessage = "Could not open support page."
            showingSupportFallbackAlert = true
            return
        }
        openURL(supportURL) { accepted in
            guard accepted == false else { return }
            supportFallbackMessage = "Unable to open support page right now. Please visit https://www.usescheduleme.com/support."
            showingSupportFallbackAlert = true
        }
    }

    /// Uploads and sends selected media into the active thread.
    private func sendPickedAttachment(_ item: PhotosPickerItem) async {
        guard let thread = dataStore.activeThread else { return }
        guard let bookingID = await dataStore.resolvedBookingIDForActiveThread(thread) else { return }
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
            let fileName = "msg_\(UUID().uuidString).\(ext)"
            try await dataStore.sendMessageAttachment(
                bookingID: bookingID,
                data: data,
                mimeType: mimeType,
                fileName: fileName,
                mediaType: mediaType
            )
            dataStore.messagesError = nil
        } catch {
            dataStore.messagesError = error.localizedDescription
        }
    }

}

private struct MessageBubbleSkeletonStack: View {
    var body: some View {
        VStack(spacing: 12) {
            MessageBubbleSkeleton(isFromUser: false, width: 180)
            MessageBubbleSkeleton(isFromUser: true, width: 140)
            MessageBubbleSkeleton(isFromUser: false, width: 200)
            MessageBubbleSkeleton(isFromUser: true, width: 160)
        }
    }
}

private struct MessageBubbleSkeleton: View {
    let isFromUser: Bool
    let width: CGFloat

    var body: some View {
        HStack {
            if isFromUser { Spacer() }
            MessageSkeletonBlock(
                width: width,
                height: 44,
                cornerRadius: 18,
                color: isFromUser
                    ? ScheduleMeTheme.accent.opacity(0.38)
                    : ScheduleMeTheme.surface
            )
            if !isFromUser { Spacer() }
        }
    }
}

private struct ThreadListSkeleton: View {
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                HStack(spacing: 12) {
                    MessageSkeletonCircle(size: 42)
                    VStack(alignment: .leading, spacing: 6) {
                        MessageSkeletonBlock(width: 160, height: 14, cornerRadius: 6)
                        MessageSkeletonBlock(width: 200, height: 12, cornerRadius: 6)
                    }
                    Spacer()
                }
                .padding(.vertical, 10)
                .padding(.horizontal, 14)
                .background(ScheduleMeTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(ScheduleMeTheme.cardBorder))
            }
        }
    }
}

private struct MessageSkeletonBlock: View {
    var width: CGFloat? = nil
    var height: CGFloat
    var cornerRadius: CGFloat = 12
    var color: Color = Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "2C2C2E"))

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(color)
            .frame(width: width, height: height)
            .messageSkeletonSweep()
    }
}

private struct MessageSkeletonCircle: View {
    var size: CGFloat
    var color: Color = Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "2C2C2E"))

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .messageSkeletonSweep()
    }
}

private struct MessageTimestampDivider: View {
    let text: String

    var body: some View {
        HStack {
            Spacer()
            Text(text)
                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.mutedText)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(ScheduleMeTheme.surface)
                .clipShape(Capsule())
            Spacer()
        }
    }
}

private struct MessageSkeletonSweep: ViewModifier {
    @State private var phase: CGFloat = -0.8

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { proxy in
                    let width = max(proxy.size.width, 1)
                    LinearGradient(
                        gradient: Gradient(colors: [
                            .clear,
                            Color.white.opacity(0.12),
                            .clear
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: width * 0.45)
                    .offset(x: phase * width * 2)
                }
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.6).repeatForever(autoreverses: false)) {
                    phase = 0.8
                }
            }
    }
}

private extension View {
    func messageSkeletonSweep() -> some View {
        modifier(MessageSkeletonSweep())
    }
}

private struct ThreadRow: View {
    let thread: MessageThread

    var body: some View {
        ScheduleMeCard {
            HStack(alignment: .top, spacing: 10) {
                Circle()
                    .fill(ScheduleMeTheme.accentSoft)
                    .frame(width: 42, height: 42)
                    .overlay(
                        Image(systemName: "bubble.left.and.bubble.right.fill")
                            .foregroundStyle(ScheduleMeTheme.accent)
                    )

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(thread.title)
                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(thread.unreadCount > 0 ? .bold : .semibold))
                            .foregroundStyle(ScheduleMeTheme.titleText)
                        Spacer()
                        if thread.unreadCount > 0 {
                            Text("\(thread.unreadCount)")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .background(ScheduleMeTheme.accent)
                                .clipShape(Capsule())
                        }
                    }

                    Text(thread.subtitle)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(thread.unreadCount > 0 ? .semibold : .medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                        .lineLimit(2)
                }
            }
        }
    }
}

private struct MessageBubble: View {
    let message: ConversationMessage
    var onMediaTap: (FullscreenMediaItem) -> Void = { _ in }

    private var mediaURL: URL? {
        if let imageURL = message.imageURL,
           let resolved = URL(string: imageURL) ?? URL(string: imageURL.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "") {
            return resolved
        }
        if let resolved = URL(string: message.content),
           resolved.scheme != nil,
           looksLikeMediaURL(resolved) {
            return resolved
        }
        return nil
    }

    private var isVideoMedia: Bool {
        if message.messageType?.lowercased() == "video" { return true }
        guard let mediaURL else { return false }
        return Self.videoExtensions.contains(mediaURL.pathExtension.lowercased())
    }

    private static let videoExtensions: Set<String> = ["mp4", "mov", "m4v", "webm"]
    private static let imageExtensions: Set<String> = ["jpg", "jpeg", "png", "heic", "webp", "gif"]

    private func looksLikeMediaURL(_ url: URL) -> Bool {
        let ext = url.pathExtension.lowercased()
        return Self.videoExtensions.contains(ext) || Self.imageExtensions.contains(ext)
    }

    var body: some View {
        HStack {
            if message.isFromUser { Spacer() }
            if let url = mediaURL {
                if isVideoMedia {
                    ZStack {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(ScheduleMeTheme.surface)
                        VStack(spacing: 8) {
                            Image(systemName: "play.circle.fill")
                                .font(.system(size: 34, weight: .semibold))
                                .foregroundStyle(ScheduleMeTheme.accent)
                            Text("Video attachment")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                .foregroundStyle(ScheduleMeTheme.mutedText)
                        }
                    }
                    .frame(maxWidth: 220, maxHeight: 160)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
                    .onTapGesture { onMediaTap(FullscreenMediaItem(url: url, isVideo: true)) }
                } else {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                        case .failure:
                            ZStack {
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(ScheduleMeTheme.surface)
                                Text("Image failed to load")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundStyle(ScheduleMeTheme.mutedText)
                            }
                        default:
                            SkeletonBlock(height: 140, cornerRadius: 16)
                        }
                    }
                    .frame(maxWidth: 220, maxHeight: 160)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
                    .onTapGesture { onMediaTap(FullscreenMediaItem(url: url, isVideo: false)) }
                }
            } else if let imageURL = message.imageURL, !imageURL.isEmpty {
                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(ScheduleMeTheme.surface)
                    Text("Image unavailable")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }
                .frame(maxWidth: 220, maxHeight: 160)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
            } else {
                Text(message.content)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                    .foregroundStyle(message.isFromUser ? .white : ScheduleMeTheme.titleText)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(message.isFromUser ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(message.isFromUser ? Color.clear : ScheduleMeTheme.cardBorder)
                    )
            }
            if !message.isFromUser { Spacer() }
        }
    }
}

private struct FullscreenMediaItem: Identifiable {
    let id = UUID()
    let url: URL
    let isVideo: Bool
}

private struct FullscreenMediaView: View {
    let item: FullscreenMediaItem
    @Environment(\.dismiss) private var dismiss
    @State private var player: AVPlayer?

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            Group {
                if item.isVideo {
                    if let player {
                        VideoPlayer(player: player)
                            .onAppear { player.play() }
                    } else {
                        ScheduleMeLoadingBar(
                            width: 120,
                            height: 7,
                            tint: .white,
                            track: Color.white.opacity(0.28)
                        )
                    }
                } else {
                    AsyncImage(url: item.url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFit()
                        case .failure:
                            Text("Unable to load image")
                                .foregroundColor(.white)
                        default:
                            ScheduleMeLoadingBar(
                                width: 120,
                                height: 7,
                                tint: .white,
                                track: Color.white.opacity(0.28)
                            )
                        }
                    }
                }
            }
            .padding(20)

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.white.opacity(0.2))
                    .clipShape(Circle())
            }
            .padding(.trailing, 16)
            .padding(.top, 12)
        }
        .onAppear {
            if item.isVideo && player == nil {
                player = AVPlayer(url: item.url)
            }
        }
        .onDisappear {
            player?.pause()
            player = nil
        }
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
