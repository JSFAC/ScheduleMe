import SwiftUI

/// Animated pseudo-progress bar:
/// ramps up quickly, then eases and slows near completion for better perceived speed.
struct ScheduleMeLoadingBar: View {
    var tint: Color = ScheduleMeTheme.accent
    var track: Color = ScheduleMeTheme.cardBorder.opacity(0.8)
    var width: CGFloat? = 180
    var height: CGFloat = 4
    var target: Double = 1.0
    var initialProgress: Double = 0.0
    var animate: Bool = true

    @State private var progress: Double = 0.0
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
            let clampedTarget = max(0, min(1, target))
            let phaseOneTarget = min(clampedTarget, max(initialProgress, 0.72))
            let phaseTwoTarget = min(clampedTarget, 0.95)

            // Hold at start briefly so users clearly see the bar begin at 0%.
            try? await Task.sleep(for: .milliseconds(140))
            if Task.isCancelled { return }

            // Smooth fast start.
            await MainActor.run {
                withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.65)) {
                    progress = phaseOneTarget
                }
            }
            try? await Task.sleep(for: .milliseconds(700))
            if Task.isCancelled { return }

            // Quick settle near the end.
            await MainActor.run {
                withAnimation(.easeOut(duration: 0.55)) {
                    progress = phaseTwoTarget
                }
            }
            try? await Task.sleep(for: .milliseconds(620))
            if Task.isCancelled { return }

            // Gentle trickle to completion while backend work finalizes.
            var current = phaseTwoTarget
            while !Task.isCancelled {
                let remaining = max(0, clampedTarget - current)
                if remaining <= 0.001 { break }
                let step = max(0.003, remaining * 0.3)
                current = min(clampedTarget, current + step)

                await MainActor.run {
                    withAnimation(.linear(duration: 0.16)) {
                        progress = current
                    }
                }
                try? await Task.sleep(for: .milliseconds(160))
            }
        }
    }
}
