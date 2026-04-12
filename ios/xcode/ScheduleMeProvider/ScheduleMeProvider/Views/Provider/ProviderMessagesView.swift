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
        let filtered = providerStore.threads.filter { !blockedThreadIDs.contains($0.id) }
        var grouped: [String: [ProviderMessageThread]] = [:]
        for thread in filtered {
            grouped[threadListIdentityKey(for: thread), default: []].append(thread)
        }
        return grouped.values
            .compactMap { group in
                group.max(by: { ($0.lastMessage?.createdAt ?? $0.createdAt) < ($1.lastMessage?.createdAt ?? $1.createdAt) })
            }
            .sorted { ($0.lastMessage?.createdAt ?? $0.createdAt) > ($1.lastMessage?.createdAt ?? $1.createdAt) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ScheduleMeBackground()
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
                                    .contentShape(Rectangle())
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
                                                RoundedRectangle(cornerRadius: 6).fill(ScheduleMeTheme.cardBorder).frame(width: 128, height: 10)
                                                RoundedRectangle(cornerRadius: 6).fill(ScheduleMeTheme.cardBorder).frame(height: 9)
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
                                    .contentShape(Rectangle())
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

    private func threadListIdentityKey(for thread: ProviderMessageThread) -> String {
        if let id = thread.profile?.id?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !id.isEmpty {
            return "id:\(id)"
        }
        if let email = thread.profile?.email?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !email.isEmpty {
            return "email:\(email)"
        }
        let name = thread.profile?.displayName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if !name.isEmpty, name != "customer" {
            return "name:\(name)"
        }
        if let bookingID = thread.bookingID?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !bookingID.isEmpty {
            return "booking:\(bookingID)"
        }
        return "thread:\(thread.id.lowercased())"
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
    @State private var attachmentItems: [PhotosPickerItem] = []
    @State private var showingPhotoPicker = false
    @State private var showingCameraPicker = false
    @State private var capturedImage: UIImage?
    @State private var isUploadingAttachment = false
    @State private var isSendingMessage = false
    @State private var sendBatchTotal = 0
    @State private var sendBatchCompleted = 0
    @State private var pendingAttachments: [PendingAttachment] = []
    @State private var fullscreenMediaURL: URL?
    @State private var fullscreenMediaType: String = "image"
    @State private var showingFullscreenMedia = false
    @State private var fullscreenGalleryURLs: [URL] = []
    @State private var fullscreenGalleryStartIndex = 0
    @State private var showingFullscreenGallery = false
    @State private var frozenMessagesDuringBatchSend: [ProviderConversationMessage]?
    @State private var isBatchSendingAttachments = false
    @FocusState private var isComposerFocused: Bool

    private struct PendingAttachment: Identifiable {
        let id = UUID()
        let data: Data
        let mimeType: String
        let fileName: String
        let mediaType: String
        let previewImage: UIImage?
    }

    private struct MediaMessageGroup: Identifiable {
        let id: String
        let messages: [ProviderConversationMessage]
        let createdAt: Date
        let isBusinessMessage: Bool
    }

    private enum ConversationRow: Identifiable {
        case message(ProviderConversationMessage)
        case mediaGroup(MediaMessageGroup)

        var id: String {
            switch self {
            case .message(let message):
                return "message-\(message.id)"
            case .mediaGroup(let group):
                return "group-\(group.id)"
            }
        }

        var createdAt: Date {
            switch self {
            case .message(let message):
                return message.createdAt
            case .mediaGroup(let group):
                return group.createdAt
            }
        }

        var isBusinessMessage: Bool {
            switch self {
            case .message(let message):
                return message.isBusinessMessage
            case .mediaGroup(let group):
                return group.isBusinessMessage
            }
        }
    }

    private var conversationID: String { thread.id }

    private var knownBookingIDs: Set<String> {
        Set(providerStore.bookings.map(\.id))
    }

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

    private var latestCustomerBooking: ProviderBookingSummary? {
        providerStore.bookings
            .filter(matchesThreadCustomer(_:))
            .sorted { ($0.scheduledStart ?? $0.createdAt) > ($1.scheduledStart ?? $1.createdAt) }
            .first
    }

    private var activeBookingID: String? {
        let candidates = ([thread.bookingID, thread.id] + possibleConversationIDs).compactMap { $0 }.removingDuplicates()
        if let direct = candidates.first(where: { knownBookingIDs.contains($0) }) {
            return direct
        }
        return latestCustomerBooking?.id
    }

    private var messageBookingIDs: [String] {
        var ids = [String]()
        if let activeBookingID, !activeBookingID.isEmpty {
            ids.append(activeBookingID)
        }
        ids.append(contentsOf: possibleConversationIDs.filter { knownBookingIDs.contains($0) })
        return ids.removingDuplicates()
    }

    private var resolvedMessages: [ProviderConversationMessage] {
        let primary = providerStore.messagesByThreadID[conversationID] ?? []
        let fallback = fallbackConversationID.flatMap { providerStore.messagesByThreadID[$0] } ?? []
        let active = activeBookingID.flatMap { providerStore.messagesByThreadID[$0] } ?? []
        let additional = possibleConversationIDs.flatMap { providerStore.messagesByThreadID[$0] ?? [] }
        var deduped: [String: ProviderConversationMessage] = [:]
        for message in (primary + fallback + active + additional) {
            deduped[message.id] = message
        }
        return deduped.values.sorted { $0.createdAt < $1.createdAt }
    }

    private var messages: [ProviderConversationMessage] {
        frozenMessagesDuringBatchSend ?? resolvedMessages
    }

    private var conversationRows: [ConversationRow] {
        var rows: [ConversationRow] = []
        var index = 0

        while index < messages.count {
            let current = messages[index]
            guard
                let imageURL = current.imageURL,
                !imageURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                messageMediaType(current) == "image"
            else {
                rows.append(.message(current))
                index += 1
                continue
            }

            var grouped = [current]
            var lookahead = index + 1
            while lookahead < messages.count, grouped.count < 6 {
                let next = messages[lookahead]
                let nextImageURL = next.imageURL?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                let closeInTime = next.createdAt.timeIntervalSince(current.createdAt) <= 120
                if next.isBusinessMessage == current.isBusinessMessage,
                   !nextImageURL.isEmpty,
                   messageMediaType(next) == "image",
                   closeInTime {
                    grouped.append(next)
                    lookahead += 1
                } else {
                    break
                }
            }

            if grouped.count >= 2 {
                rows.append(
                    .mediaGroup(
                        MediaMessageGroup(
                            id: grouped.map(\.id).joined(separator: "_"),
                            messages: grouped,
                            createdAt: current.createdAt,
                            isBusinessMessage: current.isBusinessMessage
                        )
                    )
                )
                index = lookahead
            } else {
                rows.append(.message(current))
                index += 1
            }
        }

        return rows
    }

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                if let latestCustomerBooking {
                    latestBookingPill(latestCustomerBooking)
                        .padding(.horizontal, 12)
                        .padding(.top, 8)
                        .padding(.bottom, 2)
                }

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
                                        ForEach(Array(conversationRows.enumerated()), id: \.element.id) { index, row in
                                            VStack(spacing: 8) {
                                                if shouldShowTimestamp(for: index, in: conversationRows) {
                                                    messageGroupTimestamp(for: row.createdAt)
                                                }

                                                HStack {
                                                    if row.isBusinessMessage { Spacer() }
                                                    switch row {
                                                    case .message(let message):
                                                        messageBubble(message)
                                                    case .mediaGroup(let group):
                                                        mediaGroupBubble(group)
                                                    }
                                                    if !row.isBusinessMessage { Spacer() }
                                                }
                                                .id(row.id)
                                            }
                                        }
                                    }
                                    .padding(12)
                                }
                            }
                            .frame(minHeight: geometry.size.height, alignment: .bottom)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                isComposerFocused = false
                            }
                        }
                    }
                    .onChange(of: conversationRows.count) { _, _ in
                        if let last = conversationRows.last {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                    .task {
                        isLoadingMessages = true
                        await providerStore.loadMessages(threadID: activeBookingID ?? conversationID)
                        for id in messageBookingIDs {
                            _ = try? await providerStore.markMessagesRead(threadID: id)
                        }
                        isLoadingMessages = false

                        while !Task.isCancelled {
                            try? await Task.sleep(for: .seconds(2))
                            await providerStore.loadMessages(threadID: activeBookingID ?? conversationID)
                        }
                    }
                }

            }
        }
        .safeAreaInset(edge: .bottom) {
            composerBar
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
                for id in messageBookingIDs {
                    _ = try? await providerStore.markMessagesRead(threadID: id)
                }
            }
        }
        .onChange(of: attachmentItems) { _, newItems in
            guard !newItems.isEmpty else { return }
            Task {
                await preparePickedAttachments(newItems)
                attachmentItems = []
            }
        }
        .onChange(of: capturedImage) { _, image in
            guard let image else { return }
            Task {
                await prepareCapturedImage(image)
                capturedImage = nil
            }
        }
        .photosPicker(
            isPresented: $showingPhotoPicker,
            selection: $attachmentItems,
            maxSelectionCount: 6,
            matching: .any(of: [.images, .videos])
        )
        .sheet(isPresented: $showingCameraPicker) {
            ProviderCameraPicker(image: $capturedImage)
        }
        .sheet(isPresented: $showingFullscreenGallery) {
            ProviderMediaGalleryFullscreenView(
                urls: fullscreenGalleryURLs,
                initialIndex: fullscreenGalleryStartIndex
            )
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

    private func matchesThreadCustomer(_ booking: ProviderBookingSummary) -> Bool {
        let threadProfile = thread.profile
        let bookingProfile = booking.profile
        let threadID = threadProfile?.id?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let bookingID = bookingProfile?.id?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if !threadID.isEmpty, !bookingID.isEmpty, threadID == bookingID { return true }

        let threadEmail = threadProfile?.email?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let bookingEmail = bookingProfile?.email?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if !threadEmail.isEmpty, !bookingEmail.isEmpty, threadEmail == bookingEmail { return true }

        let threadName = threadProfile?.displayName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let bookingName = bookingProfile?.displayName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if !threadName.isEmpty, threadName != "customer", !bookingName.isEmpty, threadName == bookingName { return true }

        return false
    }

    @ViewBuilder
    private func latestBookingPill(_ booking: ProviderBookingSummary) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ScheduleMeTheme.accent)
            Text("Latest booking: \(booking.service) • \((booking.scheduledStart ?? booking.createdAt).formatted(date: .abbreviated, time: .shortened))")
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.mutedText)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
    }

    private var canSend: Bool {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        return (!text.isEmpty || !pendingAttachments.isEmpty) && !isUploadingAttachment && !isBatchSendingAttachments && !isSendingMessage
    }

    private var composerBar: some View {
        VStack(spacing: 0) {
            if let sendError {
                Text(sendError)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(.red)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if !pendingAttachments.isEmpty {
                pendingAttachmentPreview(pendingAttachments)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 6)
            }

            if isSendingMessage, sendBatchTotal > 0 {
                Text("Sending \(sendBatchCompleted)/\(sendBatchTotal)…")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 4)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 8) {
                TextField("Message customer...", text: $draft)
                    .modifier(ScheduleMeFieldModifier())
                    .focused($isComposerFocused)
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
                .disabled(isUploadingAttachment || pendingAttachments.count >= 6)

                Button {
                    Task { await send() }
                } label: {
                    ZStack {
                        Circle()
                            .fill(ScheduleMeTheme.accent)
                            .frame(width: 42, height: 42)
                        if isSendingMessage {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "paperplane.fill")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Color.white)
                        }
                    }
                }
                .contentShape(Rectangle())
                .buttonStyle(.plain)
                .disabled(!canSend)
                .opacity(canSend ? 1 : 0.5)
            }
            .padding(12)
            .background(ScheduleMeTheme.pageBackground)
        }
    }

    private func shouldShowTimestamp(for index: Int, in rows: [ConversationRow]) -> Bool {
        guard index > 0 else { return true }
        let previous = rows[index - 1]
        let current = rows[index]
        let calendar = Calendar.current
        if !calendar.isDate(previous.createdAt, inSameDayAs: current.createdAt) {
            return true
        }
        return current.createdAt.timeIntervalSince(previous.createdAt) > 45 * 60
    }

    @ViewBuilder
    private func messageGroupTimestamp(for date: Date) -> some View {
        Text(date.formatted(date: .abbreviated, time: .shortened))
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
                        if messageMediaType(message) == "video" {
                            fullscreenMediaURL = url
                            fullscreenMediaType = "video"
                            showingFullscreenMedia = true
                        } else {
                            fullscreenGalleryURLs = [url]
                            fullscreenGalleryStartIndex = 0
                            showingFullscreenGallery = true
                        }
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
    private func mediaGroupBubble(_ group: MediaMessageGroup) -> some View {
        let urls = group.messages.compactMap { message -> URL? in
            guard let value = message.imageURL, let url = URL(string: value) else { return nil }
            return url
        }
        let displayURLs = Array(urls.prefix(6))
        let count = displayURLs.count
        VStack(alignment: group.isBusinessMessage ? .trailing : .leading, spacing: 6) {
            ZStack(alignment: .bottomTrailing) {
                ZStack {
                    let stackCount = min(3, count)
                    ForEach(0..<stackCount, id: \.self) { stackIndex in
                        let url = displayURLs[stackCount - 1 - stackIndex]
                        let depth = CGFloat(stackIndex)
                        mediaGroupTile(
                            url: url,
                            index: stackCount - 1 - stackIndex,
                            allURLs: displayURLs,
                            width: 214,
                            height: 138
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Color.white.opacity(0.05), lineWidth: 0.8)
                        )
                        .offset(x: depth * 8, y: depth * 6)
                    }
                }
                .frame(width: 232, height: 154, alignment: .topLeading)
                .contentShape(Rectangle())
                .onTapGesture {
                    fullscreenGalleryURLs = displayURLs
                    fullscreenGalleryStartIndex = 0
                    showingFullscreenGallery = true
                }

                HStack(spacing: 5) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.system(size: 10, weight: .semibold))
                    Text("\(count) Photo\(count == 1 ? "" : "s")")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                }
                .foregroundStyle(Color.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(ScheduleMeTheme.accent.opacity(0.9))
                .clipShape(Capsule())
                .padding(.trailing, 6)
                .padding(.bottom, 6)
                .allowsHitTesting(false)
            }
        }
        .padding(6)
        .background(group.isBusinessMessage ? ScheduleMeTheme.accent.opacity(0.12) : ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(group.isBusinessMessage ? ScheduleMeTheme.accent.opacity(0.3) : ScheduleMeTheme.cardBorder)
        )
    }

    @ViewBuilder
    private func mediaGroupTile(url: URL, index: Int, allURLs: [URL], width: CGFloat, height: CGFloat) -> some View {
        RetryableMessageImage(url: url)
        .frame(width: width, height: height)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .onTapGesture {
            fullscreenGalleryURLs = allURLs
            fullscreenGalleryStartIndex = index
            showingFullscreenGallery = true
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
                RetryableMessageImage(url: url)
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
        guard let bookingID = activeBookingID, !bookingID.isEmpty else {
            sendError = "No active booking found for this conversation."
            return
        }

        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty && pendingAttachments.isEmpty {
            return
        }

        let attachmentsToSend = pendingAttachments
        let shouldFreeze = attachmentsToSend.count > 1
        isSendingMessage = true
        sendBatchTotal = attachmentsToSend.count + (text.isEmpty ? 0 : 1)
        sendBatchCompleted = 0
        if shouldFreeze {
            frozenMessagesDuringBatchSend = resolvedMessages
            isBatchSendingAttachments = true
        }

        do {
            for nextAttachment in attachmentsToSend {
                _ = try await providerStore.sendMessageAttachment(
                    threadID: bookingID,
                    data: nextAttachment.data,
                    mimeType: nextAttachment.mimeType,
                    fileName: nextAttachment.fileName,
                    mediaType: nextAttachment.mediaType
                )
                sendBatchCompleted += 1
            }
            if !attachmentsToSend.isEmpty {
                pendingAttachments = []
            }
            if !text.isEmpty {
                draft = ""
                _ = try await providerStore.sendMessage(threadID: bookingID, content: text)
                sendBatchCompleted += 1
            }
            await providerStore.loadMessages(threadID: bookingID)
            sendError = nil
            isComposerFocused = false
        } catch {
            sendError = humanReadableUploadError(error)
            await providerStore.loadMessages(threadID: bookingID)
        }

        if shouldFreeze {
            frozenMessagesDuringBatchSend = nil
            isBatchSendingAttachments = false
        }
        isSendingMessage = false
        sendBatchTotal = 0
        sendBatchCompleted = 0
    }

    private func preparePickedAttachments(_ items: [PhotosPickerItem]) async {
        isUploadingAttachment = true
        defer { isUploadingAttachment = false }

        let remainingSlots = max(0, 6 - pendingAttachments.count)
        guard remainingSlots > 0 else {
            sendError = "You can attach up to 6 items at once."
            return
        }

        do {
            var prepared: [PendingAttachment] = []
            for item in items.prefix(remainingSlots) {
                guard let data = try await item.loadTransferable(type: Data.self) else {
                    throw DataStoreError.server("Could not read selected media.")
                }
                let contentType = item.supportedContentTypes.first
                let mimeType = contentType?.preferredMIMEType ?? "image/jpeg"
                let mediaType = (contentType?.conforms(to: .movie) == true) ? "video" : "image"
                let ext = mediaType == "video" ? "mp4" : "jpg"
                let fileName = "provider_msg_\(UUID().uuidString).\(ext)"
                prepared.append(
                    PendingAttachment(
                        data: data,
                        mimeType: mimeType,
                        fileName: fileName,
                        mediaType: mediaType,
                        previewImage: mediaType == "image" ? UIImage(data: data) : nil
                    )
                )
            }
            pendingAttachments.append(contentsOf: prepared)
            sendError = nil
        } catch {
            sendError = humanReadableUploadError(error)
        }
    }

    private func prepareCapturedImage(_ image: UIImage) async {
        guard let data = image.jpegData(compressionQuality: 0.85) else {
            sendError = "Could not process captured image."
            return
        }
        if pendingAttachments.count >= 6 {
            sendError = "You can attach up to 6 items at once."
            return
        }
        pendingAttachments.append(
            PendingAttachment(
                data: data,
                mimeType: "image/jpeg",
                fileName: "provider_camera_\(UUID().uuidString).jpg",
                mediaType: "image",
                previewImage: image
            )
        )
        sendError = nil
    }

    @ViewBuilder
    private func pendingAttachmentPreview(_ attachments: [PendingAttachment]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ready to send \(attachments.count) attachment\(attachments.count == 1 ? "" : "s")")
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.titleText)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(attachments) { attachment in
                        HStack(spacing: 6) {
                            if let image = attachment.previewImage {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 42, height: 42)
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            } else {
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(ScheduleMeTheme.pageBackground)
                                    .frame(width: 42, height: 42)
                                    .overlay(
                                        Image(systemName: attachment.mediaType == "video" ? "video.fill" : "paperclip")
                                            .font(.system(size: 14, weight: .semibold))
                                            .foregroundStyle(ScheduleMeTheme.accent)
                                    )
                            }
                            Button {
                                pendingAttachments.removeAll { $0.id == attachment.id }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Color(hex: "FCA5A5"))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 4)
                        .padding(.horizontal, 6)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorder))
                    }
                }
            }
        }
        .padding(10)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
    }

    private func humanReadableUploadError(_ error: Error) -> String {
        let message = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = message.lowercased()
        if lower.contains("413") || lower.contains("request entity too large") || lower.contains("payload too large") {
            return "Attachment is too large to upload. Please choose a smaller image or video."
        }
        if lower.contains("blocked by safety filters") || lower.contains("safety filter") || lower.contains("moderation") {
            return "Upload was blocked by safety filters. Try another image or a cropped version."
        }
        if lower.contains("invalid media bucket") {
            return "Message media storage is still syncing. Please try again in a moment."
        }
        if lower.contains("unsupported") || lower.contains("invalid file") {
            return "That file type is not supported. Please choose a standard image or video."
        }
        return message
    }

}

private struct RetryableMessageImage: View {
    let url: URL
    @State private var loadedImage: UIImage?
    @State private var isLoading = false
    @State private var loadFailed = false
    @State private var loadTask: Task<Void, Never>?
    private let maxRetries = 2

    var body: some View {
        Group {
            if let loadedImage {
                Image(uiImage: loadedImage)
                    .resizable()
                    .scaledToFill()
            } else if isLoading {
                Color(hex: "1F2937").redacted(reason: .placeholder)
            } else {
                Color(hex: "1F2937")
                    .overlay(
                        Image(systemName: "photo")
                            .foregroundStyle(Color(hex: "94A3B8"))
                    )
            }
        }
        .onAppear {
            startLoadingIfNeeded(force: loadFailed)
        }
        .onDisappear {
            loadTask?.cancel()
            loadTask = nil
            isLoading = false
        }
    }

    private func startLoadingIfNeeded(force: Bool) {
        guard loadedImage == nil || force else { return }
        guard !isLoading else { return }
        loadTask?.cancel()
        isLoading = true
        loadFailed = false

        loadTask = Task {
            var resultImage: UIImage?

            for attempt in 0...maxRetries {
                if Task.isCancelled { return }
                do {
                    let request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 12)
                    let (data, response) = try await APIClient.shared.performRaw(request, category: .media)
                    guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                        throw URLError(.badServerResponse)
                    }
                    if let decoded = UIImage(data: data) {
                        resultImage = decoded
                        break
                    }
                } catch {
                    if attempt < maxRetries {
                        try? await Task.sleep(for: .milliseconds(450))
                    }
                }
            }

            await MainActor.run {
                loadedImage = resultImage
                loadFailed = resultImage == nil
                isLoading = false
            }
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
                            ScheduleMeLoadingBar(
                                tint: .white,
                                track: Color.white.opacity(0.26),
                                width: 180,
                                height: 4
                            )
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

private struct ProviderMediaGalleryFullscreenView: View {
    @Environment(\.dismiss) private var dismiss
    let urls: [URL]
    let initialIndex: Int
    @State private var selectedIndex: Int = 0

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.black.ignoresSafeArea()

            TabView(selection: $selectedIndex) {
                ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFit()
                        case .failure:
                            VStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle")
                                Text("Unable to load image")
                            }
                            .foregroundStyle(Color.white.opacity(0.82))
                        default:
                            ScheduleMeLoadingBar(
                                tint: .white,
                                track: Color.white.opacity(0.26),
                                width: 180,
                                height: 4
                            )
                        }
                    }
                    .tag(index)
                    .padding(10)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

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
        .onAppear {
            selectedIndex = min(max(0, initialIndex), max(0, urls.count - 1))
        }
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
