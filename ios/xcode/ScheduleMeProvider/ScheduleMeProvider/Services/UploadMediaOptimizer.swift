import Foundation
import UIKit

enum UploadMediaOptimizer {
    // Payload uploader currently sends base64 JSON, so we keep binary files smaller
    // to avoid hitting API/proxy payload limits before storage limits.
    private static let maxImageBytes = 2_400_000
    private static let maxVideoBytes = 8_000_000
    private static let imageDimensionSteps: [CGFloat] = [2300, 2000, 1700, 1400]
    private static let imageQualitySteps: [CGFloat] = [0.82, 0.74, 0.66, 0.58, 0.50, 0.42, 0.35]

    static func prepareForUpload(
        data: Data,
        mimeType: String,
        mediaType: String
    ) throws -> (data: Data, mimeType: String, fileExtension: String) {
        if mediaType.lowercased() == "video" {
            guard data.count <= maxVideoBytes else {
                throw DataStoreError.server("Video is too large for upload. Please trim/compress the video and try again.")
            }
            return (data, mimeType, fileExtension(from: mimeType, mediaType: mediaType))
        }

        // For images, normalize to JPEG and compress adaptively.
        guard let image = UIImage(data: data) else {
            if data.count <= maxImageBytes {
                return (data, mimeType, fileExtension(from: mimeType, mediaType: mediaType))
            }
            throw DataStoreError.server("Image is too large to upload. Please choose a smaller image.")
        }

        let normalized = normalizedImage(image)
        var bestCandidate: Data?

        for maxDimension in imageDimensionSteps {
            let resized = resizeIfNeeded(normalized, maxDimension: maxDimension)
            for quality in imageQualitySteps {
                guard let jpeg = resized.jpegData(compressionQuality: quality) else { continue }
                bestCandidate = jpeg
                if jpeg.count <= maxImageBytes {
                    return (jpeg, "image/jpeg", "jpg")
                }
            }
        }

        if let bestCandidate, bestCandidate.count <= maxImageBytes {
            return (bestCandidate, "image/jpeg", "jpg")
        }

        throw DataStoreError.server("Image is too large to upload. Please choose a smaller image.")
    }

    private static func fileExtension(from mimeType: String, mediaType: String) -> String {
        let lowered = mimeType.lowercased()
        if lowered.contains("png") { return "png" }
        if lowered.contains("heic") || lowered.contains("heif") { return "heic" }
        if lowered.contains("webp") { return "webp" }
        if lowered.contains("gif") { return "gif" }
        if lowered.contains("jpeg") || lowered.contains("jpg") { return "jpg" }
        if lowered.contains("mp4") { return "mp4" }
        return mediaType.lowercased() == "video" ? "mp4" : "jpg"
    }

    private static func normalizedImage(_ image: UIImage) -> UIImage {
        if image.imageOrientation == .up { return image }
        let renderer = UIGraphicsImageRenderer(size: image.size)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
    }

    private static func resizeIfNeeded(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let size = image.size
        let longest = max(size.width, size.height)
        guard longest > maxDimension else { return image }

        let scale = maxDimension / longest
        let target = CGSize(width: max(1, floor(size.width * scale)), height: max(1, floor(size.height * scale)))
        let renderer = UIGraphicsImageRenderer(size: target)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }
}
