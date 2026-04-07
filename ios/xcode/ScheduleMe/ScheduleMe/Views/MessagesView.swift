// FILE OVERVIEW:
// Messages inbox + thread detail + composer + polling behavior.
//
// DEBUG NOTES:
// Thread loading, badge pills, and message bubble rendering are managed here.

import SwiftUI

struct MessagesView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var appState: AppState
    @Environment(\.openURL) private var openURL
    @State private var draft = ""
    @State private var pollingTask: Task<Void, Never>?
    @State private var selectedImage: FullscreenImageItem?
    @State private var didInitialScroll = false
    private let bottomAnchor = "bottom"
    private let inputBarHeight: CGFloat = 52

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
        .fullScreenCover(item: $selectedImage) { item in
            FullscreenImageView(url: item.url)
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
                            } else {
                                if dataStore.hasMoreMessages {
                                    SkeletonBlock(width: 120, height: 14, cornerRadius: 6)
                                        .frame(maxWidth: .infinity)
                                        .onAppear {
                                            Task { await dataStore.loadMoreMessages() }
                                        }
                                }
                                ForEach(dataStore.messages) { message in
                                    MessageBubble(message: message) { url in
                                        selectedImage = FullscreenImageItem(url: url)
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
                if dataStore.isLoadingThreads && dataStore.threads.isEmpty {
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

            Button {
                Task {
                    let message = draft
                    draft = ""
                    await dataStore.sendMessage(message)
                }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(ScheduleMeTheme.accent)
                    .clipShape(Circle())
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || dataStore.isSendingMessage)
        }
        .padding(.horizontal, 20)
        .padding(.top, 4)
        .padding(.bottom, 8)
        .frame(height: inputBarHeight)
        .background(
            Rectangle()
                .fill(.ultraThinMaterial)
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
        let subject = "Report Conversation \(thread.id)"
        let body = "Please review this thread for abusive/offensive content.\nThread ID: \(thread.id)\nBusiness: \(thread.title)"
        openSupportMail(subject: subject, body: body)
    }

    /// Opens support contact route from message safety tools.
    private func contactSupport(activeThreadID: String?) {
        let subject = "ScheduleMe Support"
        let body: String
        if let activeThreadID {
            body = "I need help with conversation ID: \(activeThreadID)"
        } else {
            body = "I need help with my ScheduleMe account."
        }
        openSupportMail(subject: subject, body: body)
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
            SkeletonBlock(
                width: width,
                height: 44,
                cornerRadius: 18,
                color: isFromUser ? ScheduleMeTheme.accent.opacity(0.22) : ScheduleMeTheme.surface
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(isFromUser ? Color.clear : ScheduleMeTheme.cardBorder)
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
                    SkeletonCircle(size: 42)
                    VStack(alignment: .leading, spacing: 6) {
                        SkeletonBlock(width: 160, height: 14, cornerRadius: 6)
                        SkeletonBlock(width: 200, height: 12, cornerRadius: 6)
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
    var onImageTap: (URL) -> Void = { _ in }

    var body: some View {
        HStack {
            if message.isFromUser { Spacer() }
            if let imageURL = message.imageURL,
               let url = URL(string: imageURL) ?? URL(string: imageURL.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "") {
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
                .onTapGesture { onImageTap(url) }
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

private struct FullscreenImageItem: Identifiable {
    let id = UUID()
    let url: URL
}

private struct FullscreenImageView: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFit()
                case .failure:
                    Text("Unable to load image")
                        .foregroundColor(.white)
                default:
                    ProgressView().tint(.white)
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
    }
}
