import SwiftUI

/// Animated pseudo-progress bar:
/// ramps up quickly, then eases and slows near completion for better perceived speed.
struct ScheduleMeLoadingBar: View {
    var tint: Color = ScheduleMeTheme.accent
    var track: Color = ScheduleMeTheme.cardBorder.opacity(0.8)
    var width: CGFloat? = 180
    var height: CGFloat = 4
    var target: Double = 0.96
    var initialProgress: Double = 0.03
    var animate: Bool = true

    @State private var progress: Double = 0.03
    @State private var animationTask: Task<Void, Never>?

    var body: some View {
        GeometryReader { proxy in
            let fullWidth = max(1, proxy.size.width)
            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(track)
                Capsule(style: .continuous)
                    .fill(tint)
                    .frame(width: fullWidth * progress)
            }
        }
        .frame(width: width, height: height)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading")
        .accessibilityValue("In progress")
        .onAppear {
            progress = max(0, min(1, initialProgress))
            if animate {
                startAnimationIfNeeded()
            }
        }
        .onDisappear {
            animationTask?.cancel()
            animationTask = nil
            progress = max(0, min(1, initialProgress))
        }
    }

    private func startAnimationIfNeeded() {
        guard animationTask == nil else { return }
        progress = max(0, min(1, initialProgress))
        animationTask = Task {
            var current = max(0, min(1, initialProgress))
            while !Task.isCancelled {
                let remaining = max(0, target - current)
                // Large jump early, then tapered increments as we approach the target.
                let step = max(0.002, remaining * 0.24)
                current = min(target, current + step)
                await MainActor.run {
                    withAnimation(.easeOut(duration: 0.18)) {
                        progress = current
                    }
                }
                try? await Task.sleep(for: .milliseconds(current >= target - 0.002 ? 420 : 120))
            }
        }
    }
}
