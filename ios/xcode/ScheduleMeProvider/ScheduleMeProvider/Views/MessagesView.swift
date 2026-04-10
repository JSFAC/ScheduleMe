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
    @State private var draft = ""
    @State private var pollingTask: Task<Void, Never>?
    @State private var selectedImage: FullscreenImageItem?
    @State private var didInitialScroll = false
    @Environment(\.floatingTabBarHeight) private var tabBarHeight
    private let bottomAnchor = "bottom"

    var body: some View {
        NavigationStack {
            ZStack {
                if let activeThread = dataStore.activeThread {
                    messageDetailScreen(activeThread)
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                } else {
                    ScheduleMeScreen(scrolls: false) {
                        messageThreadsView
                    }
                    .transition(.move(edge: .leading).combined(with: .opacity))
                }
            }
            .animation(.easeInOut(duration: 0.22), value: dataStore.activeThread?.id)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(dataStore.activeThread != nil ? .hidden : .visible, for: .navigationBar)
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
        .onChange(of: dataStore.activeThread?.id) { _, _ in
            didInitialScroll = false
            startPolling()
        }
        .onChange(of: dataStore.isLoadingMessages) { _, loading in
            if loading == false { didInitialScroll = false }
        }
        .onAppear { startPolling() }
        .onDisappear { stopPolling() }
        .fullScreenCover(item: $selectedImage) { item in
            FullscreenImageView(url: item.url)
        }
    }

    // MARK: - Thread Detail (green extends behind status bar)
    // The header's .background() uses ignoresSafeArea(edges: .top) so the green fills
    // behind the status bar while the HStack content stays below the status bar naturally.

    @ViewBuilder
    private func messageDetailScreen(_ activeThread: MessageThread) -> some View {
        ZStack {
            ScheduleMeTheme.creamBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                // Green header — background fills behind status bar via ignoresSafeArea on background only
                HStack {
                    Button {
                        withAnimation(.easeInOut(duration: 0.22)) {
                            dataStore.closeActiveThread()
                        }
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.15))
                            .clipShape(Circle())
                    }

                    VStack(alignment: .leading, spacing: 3) {
                        Text(activeThread.title)
                            .font(.custom(ScheduleMeTheme.fontName, size: 17).weight(.semibold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Text(activeThread.service)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundStyle(Color.white.opacity(0.75))
                    }
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 14)
                .background(
                    ScheduleMeTheme.headerGreen
                        .ignoresSafeArea(edges: .top) // fills behind status bar; content still below status bar
                )

                // Messages scroll area
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
                        .padding(.top, 12)
                        .padding(.bottom, 8)
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
                    .transaction { t in t.disablesAnimations = true }
                }
                .layoutPriority(1)
            }
            // Input bar pinned just above the system tab bar safe area
            .safeAreaInset(edge: .bottom) {
                messageInputBar(for: activeThread)
                    .background(ScheduleMeTheme.creamBackground.ignoresSafeArea())
            }
        }
    }

    // MARK: - Thread List

    private var messageThreadsView: some View {
        VStack(spacing: 0) {
            ScheduleMeHeaderBlock(
                title: "Messages",
                subtitle: "Your conversations",
                actionTitle: "Bookings",
                action: { tabRouter.selected = .bookings }
            ) {
                EmptyView()
            }
            .padding(.top, 4)

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
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 24)
        }
    }

    // MARK: - Input Bar

    @ViewBuilder
    private func messageInputBar(for thread: MessageThread) -> some View {
        HStack(spacing: 10) {
            TextField("Message \(thread.title)", text: $draft, axis: .vertical)
                .lineLimit(1...4)
                .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                .foregroundColor(ScheduleMeTheme.titleText)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(ScheduleMeTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(ScheduleMeTheme.cardBorder)
                )

            Button {
                Task {
                    let message = draft
                    draft = ""
                    await dataStore.sendMessage(message)
                }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(
                        draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? Color(hex: "CBD5E1")
                            : ScheduleMeTheme.accent
                    )
                    .clipShape(Circle())
                    .animation(.easeInOut(duration: 0.15), value: draft.isEmpty)
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || dataStore.isSendingMessage)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .overlay(
            Rectangle()
                .frame(height: 0.5)
                .foregroundStyle(ScheduleMeTheme.cardBorder),
            alignment: .top
        )
    }

    // MARK: - Helpers

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

    private func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}

// MARK: - Skeleton Views

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

// MARK: - Thread Row

private struct ThreadRow: View {
    let thread: MessageThread

    var body: some View {
        ScheduleMeCard {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    Circle()
                        .fill(ScheduleMeTheme.accentSoft)
                        .frame(width: 44, height: 44)
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                }

                VStack(alignment: .leading, spacing: 5) {
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
                                .padding(.vertical, 4)
                                .background(ScheduleMeTheme.accent)
                                .clipShape(Capsule())
                        }
                    }
                    Text(thread.subtitle)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(thread.unreadCount > 0 ? .semibold : .medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                        .lineLimit(2)

                    Text(thread.service)
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(ScheduleMeTheme.accentSoft)
                        .clipShape(Capsule())
                }
            }
        }
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: ConversationMessage
    var onImageTap: (URL) -> Void = { _ in }

    var body: some View {
        HStack {
            if message.isFromUser { Spacer(minLength: 60) }
            if let imageURL = message.imageURL,
               let url = URL(string: imageURL.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? imageURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure:
                        ZStack {
                            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(ScheduleMeTheme.surface)
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
                    RoundedRectangle(cornerRadius: 16, style: .continuous).fill(ScheduleMeTheme.surface)
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
                    .padding(.vertical, 11)
                    .background(message.isFromUser ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                    .clipShape(
                        UnevenRoundedRectangle(
                            topLeadingRadius: 18,
                            bottomLeadingRadius: message.isFromUser ? 18 : 5,
                            bottomTrailingRadius: message.isFromUser ? 5 : 18,
                            topTrailingRadius: 18
                        )
                    )
                    .overlay(
                        UnevenRoundedRectangle(
                            topLeadingRadius: 18,
                            bottomLeadingRadius: message.isFromUser ? 18 : 5,
                            bottomTrailingRadius: message.isFromUser ? 5 : 18,
                            topTrailingRadius: 18
                        )
                        .stroke(message.isFromUser ? Color.clear : ScheduleMeTheme.cardBorder)
                    )
                    .shadow(
                        color: message.isFromUser
                            ? ScheduleMeTheme.accent.opacity(0.2)
                            : Color.black.opacity(0.04),
                        radius: 4, y: 2
                    )
            }
            if !message.isFromUser { Spacer(minLength: 60) }
        }
    }
}

// MARK: - Fullscreen Image

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
                case .success(let image): image.resizable().scaledToFit()
                case .failure: Text("Unable to load image").foregroundColor(.white)
                default: ProgressView().tint(.white)
                }
            }
            .padding(20)

            Button { dismiss() } label: {
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
