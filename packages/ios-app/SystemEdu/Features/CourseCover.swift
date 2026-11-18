import SwiftUI
import ImageIO

struct CourseCover: View {
    let course: ContentCourse
    @State private var image: UIImage?

    var body: some View {
        GeometryReader { geometry in
            Group {
                if let image {
                    Image(uiImage: image).resizable().scaledToFill()
                        .accessibilityLabel("\(course.title)项目封面")
                        .accessibilityIdentifier("course-cover-\(course.id)")
                } else {
                    ZStack {
                        Color.forest.opacity(0.12)
                        Image(systemName: "photo").foregroundStyle(Color.quiet)
                    }.accessibilityLabel("封面暂时无法显示")
                }
            }.frame(width: geometry.size.width, height: geometry.size.height).clipped()
        }.task(id: course.coverPath) {
            guard let url = course.coverURL else { image = nil; return }
            let loaded = await Task.detached(priority: .utility) { CourseImageCache.load(url) }.value
            if !Task.isCancelled { image = loaded }
        }
    }
}

// Local images are decoded away from the main thread and bounded by pixel memory.
enum CourseImageCache {
    private static let cache: NSCache<NSURL, UIImage> = {
        let result = NSCache<NSURL, UIImage>()
        result.totalCostLimit = 24 * 1024 * 1024
        return result
    }()
    static func load(_ url: URL) -> UIImage? {
        if let existing = cache.object(forKey: url as NSURL) { return existing }
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let decoded = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceThumbnailMaxPixelSize: 960,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceShouldCacheImmediately: true
              ] as CFDictionary) else { return nil }
        let image = UIImage(cgImage: decoded)
        cache.setObject(image, forKey: url as NSURL, cost: decoded.bytesPerRow * decoded.height)
        return image
    }
}
