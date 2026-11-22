import Foundation
import WebKit

@MainActor
final class DayflowSchemeHandler: NSObject, WKURLSchemeHandler {
    private enum SchemeError {
        static let domain = "com.dayflow.app.web-resources"
    }

    private let webRoot: URL

    override init() {
        let resources = Bundle.main.resourceURL ?? URL(fileURLWithPath: "/")
        webRoot = resources
            .appendingPathComponent("Web", isDirectory: true)
            .standardizedFileURL
            .resolvingSymlinksInPath()
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        do {
            let fileURL = try resourceURL(for: urlSchemeTask.request.url)
            let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
            let mimeType = Self.mimeType(for: fileURL.pathExtension)
            let encoding = Self.isTextMimeType(mimeType) ? "utf-8" : nil
            let response = URLResponse(
                url: urlSchemeTask.request.url ?? fileURL,
                mimeType: mimeType,
                expectedContentLength: data.count,
                textEncodingName: encoding
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        // Resource reads are synchronous, so there is no outstanding work to cancel.
    }

    private func resourceURL(for requestURL: URL?) throws -> URL {
        guard let requestURL, requestURL.scheme?.lowercased() == "dayflow" else {
            throw schemeError(code: 400, description: "Invalid Dayflow resource URL")
        }

        var relativePath = requestURL.path
        while relativePath.hasPrefix("/") {
            relativePath.removeFirst()
        }
        if relativePath.isEmpty {
            relativePath = "index.html"
        }

        guard !relativePath.contains("\0"), !relativePath.contains("\\") else {
            throw schemeError(code: 403, description: "Invalid resource path")
        }
        guard !relativePath.split(separator: "/", omittingEmptySubsequences: false).contains("..") else {
            throw schemeError(code: 403, description: "Path traversal is not allowed")
        }

        let candidate = webRoot
            .appendingPathComponent(relativePath)
            .standardizedFileURL
            .resolvingSymlinksInPath()
        try requireInsideWebRoot(candidate)

        if isRegularFile(candidate) {
            return candidate
        }

        // Extensionless paths are SPA routes (including external dayflow:// links).
        if candidate.pathExtension.isEmpty {
            let indexURL = webRoot.appendingPathComponent("index.html").standardizedFileURL
            try requireInsideWebRoot(indexURL)
            if isRegularFile(indexURL) {
                return indexURL
            }
        }

        throw schemeError(code: 404, description: "Resource not found: \(relativePath)")
    }

    private func requireInsideWebRoot(_ url: URL) throws {
        let rootPath = webRoot.path
        let candidatePath = url.path
        guard candidatePath == rootPath || candidatePath.hasPrefix(rootPath + "/") else {
            throw schemeError(code: 403, description: "Resource escapes the Web directory")
        }
    }

    private func isRegularFile(_ url: URL) -> Bool {
        (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true
    }

    private func schemeError(code: Int, description: String) -> NSError {
        NSError(
            domain: SchemeError.domain,
            code: code,
            userInfo: [NSLocalizedDescriptionKey: description]
        )
    }

    private static func isTextMimeType(_ mimeType: String) -> Bool {
        mimeType.hasPrefix("text/") || mimeType == "application/json" ||
            mimeType == "application/xml" || mimeType == "image/svg+xml" ||
            mimeType == "application/wasm"
    }

    private static func mimeType(for pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "html", "htm": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css", "map": return "application/json"
        case "json": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "webp": return "image/webp"
        case "avif": return "image/avif"
        case "ico": return "image/x-icon"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "wasm": return "application/wasm"
        case "txt": return "text/plain"
        case "xml": return "application/xml"
        case "pdf": return "application/pdf"
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "mp4": return "video/mp4"
        case "webm": return "video/webm"
        default: return "application/octet-stream"
        }
    }
}
