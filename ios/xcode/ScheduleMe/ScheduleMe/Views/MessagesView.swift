import SwiftUI

struct MessagesView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter
    @State private var draft = ""

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                VStack(spacing: 0) {
                    if let activeThread = dataStore.activeThread {
                        VStack(spacing: 16) {
                            HStack {
                                Button {
                                    dataStore.closeActiveThread()
                                } label: {
                                    Image(systemName: "chevron.left")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundStyle(ScheduleMeTheme.titleText)
                                        .frame(width: 40, height: 40)
                                        .background(.white)
                                        .clipShape(Circle())
                                }

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(activeThread.title)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                                    Text(activeThread.service)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundStyle(ScheduleMeTheme.mutedText)
                                }
                                Spacer()
                            }
                            .padding(.horizontal, 20)
                            .padding(.top, 16)

                            ScrollView {
                                VStack(spacing: 12) {
                                    ForEach(dataStore.messages) { message in
                                        MessageBubble(message: message)
                                    }
                                }
                                .padding(.horizontal, 20)
                                .padding(.bottom, 16)
                            }
                            .scrollBounceBehavior(.basedOnSize)

                            HStack(spacing: 12) {
                                TextField("Message \(activeThread.title)", text: $draft, axis: .vertical)
                                    .lineLimit(1...4)
                                    .scheduleMeFieldStyle()

                                Button {
                                    Task {
                                        let message = draft
                                        draft = ""
                                        await dataStore.sendMessage(message)
                                    }
                                } label: {
                                    Image(systemName: "arrow.up")
                                        .font(.system(size: 16, weight: .black))
                                        .foregroundStyle(.white)
                                        .frame(width: 48, height: 48)
                                        .background(ScheduleMeTheme.accent)
                                        .clipShape(Circle())
                                }
                                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || dataStore.isSendingMessage)
                            }
                            .padding(20)
                        }
                    } else {
                        ScheduleMeHeaderBlock(
                            title: "Messages",
                            subtitle: "All caught up",
                            actionTitle: "Bookings",
                            action: { tabRouter.selected = .bookings }
                        ) {
                            EmptyView()
                        }

                        VStack(alignment: .leading, spacing: 16) {
                            if dataStore.isLoadingThreads && dataStore.threads.isEmpty {
                                ProgressView()
                                    .tint(ScheduleMeTheme.accent)
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
                        .padding(.top, 18)
                        .padding(.bottom, 30)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            await dataStore.loadThreads(for: appState.userID)
        }
    }
}

private struct ThreadRow: View {
    let thread: MessageThread

    var body: some View {
        ScheduleMeCard {
            HStack(alignment: .top, spacing: 14) {
                Circle()
                    .fill(ScheduleMeTheme.accentSoft)
                    .frame(width: 48, height: 48)
                    .overlay(
                        Image(systemName: "bubble.left.and.bubble.right.fill")
                            .foregroundStyle(ScheduleMeTheme.accent)
                    )

                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(thread.title)
                            .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
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
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                        .lineLimit(2)
                }
            }
        }
    }
}

private struct MessageBubble: View {
    let message: ConversationMessage

    var body: some View {
        HStack {
            if message.isFromUser { Spacer() }
            Text(message.content)
                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                .foregroundStyle(message.isFromUser ? .white : ScheduleMeTheme.titleText)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(message.isFromUser ? ScheduleMeTheme.accent : .white)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(message.isFromUser ? Color.clear : ScheduleMeTheme.cardBorder)
                )
            if !message.isFromUser { Spacer() }
        }
    }
}
