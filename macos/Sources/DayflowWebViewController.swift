import AppKit
import WebKit

@MainActor
final class DayflowWebViewController: NSViewController, WKNavigationDelegate, WKUIDelegate {
    private static let initialURL = URL(string: "dayflow://app/index.html")!

    private let notificationManager: NotificationManager
    private let schemeHandler = DayflowSchemeHandler()
    private var dayflowWebView: WKWebView?
    private var isBridgeReady = false
    private var queuedNativeActions: [NativeAction] = []

    init(notificationManager: NotificationManager) {
        self.notificationManager = notificationManager
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("DayflowWebViewController does not support NSCoder")
    }

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: "dayflow")
        configuration.userContentController.add(
            ScriptMessageProxy(target: self),
            name: "dayflow"
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = true
        dayflowWebView = webView
        view = webView
    }

    func loadInitialApp() {
        loadAppURL(Self.initialURL)
    }

    func loadExternalURL(_ url: URL) {
        guard url.scheme?.lowercased() == "dayflow" else { return }
        loadAppURL(url)
    }

    private func loadAppURL(_ url: URL) {
        isBridgeReady = false
        _ = dayflowWebView?.load(URLRequest(url: url))
    }

    func dispatchNativeAction(_ action: NativeAction) {
        guard isBridgeReady else {
            queuedNativeActions.append(action)
            return
        }
        deliverNativeAction(action)
    }

    private func flushNativeActions() {
        let actions = queuedNativeActions
        queuedNativeActions.removeAll()
        for action in actions {
            deliverNativeAction(action)
        }
    }

    private func deliverNativeAction(_ action: NativeAction) {
        guard let webView = dayflowWebView else { return }
        do {
            let data = try JSONSerialization.data(withJSONObject: action.jsonObject)
            guard let detailJSON = String(data: data, encoding: .utf8) else { return }
            let script = "window.dispatchEvent(new CustomEvent('dayflow:native-action',{detail:\(detailJSON)}));"
            webView.evaluateJavaScript(script) { _, error in
                if let error {
                    NSLog("Dayflow native action delivery failed: \(error.localizedDescription)")
                }
            }
        } catch {
            NSLog("Dayflow native action encoding failed: \(error.localizedDescription)")
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        switch url.scheme?.lowercased() {
        case "http", "https":
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        case "dayflow", "about":
            decisionHandler(.allow)
        default:
            if navigationAction.navigationType == .linkActivated {
                NSWorkspace.shared.open(url)
            }
            decisionHandler(.cancel)
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        if url.scheme?.lowercased() == "dayflow" {
            loadAppURL(url)
        } else if let scheme = url.scheme?.lowercased(), ["http", "https", "mailto"].contains(scheme) {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable () -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = "Dayflow"
        alert.informativeText = message
        alert.addButton(withTitle: "好")
        let completion: (NSApplication.ModalResponse) -> Void = { _ in completionHandler() }
        if let window = view.window {
            alert.beginSheetModal(for: window, completionHandler: completion)
        } else {
            completion(alert.runModal())
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (Bool) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = "Dayflow"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "继续")
        alert.addButton(withTitle: "取消")
        let completion: (NSApplication.ModalResponse) -> Void = { response in
            completionHandler(response == .alertFirstButtonReturn)
        }
        if let window = view.window {
            alert.beginSheetModal(for: window, completionHandler: completion)
        } else {
            completion(alert.runModal())
        }
    }

    fileprivate func handleScriptMessage(_ message: WKScriptMessage) {
        guard message.name == "dayflow" else { return }
        guard let body = message.body as? [String: Any],
              let id = body["id"] as? String,
              !id.isEmpty,
              let type = body["type"] as? String else {
            NSLog("Dayflow ignored a malformed script message")
            return
        }
        guard let payload = body["payload"] as? [String: Any] else {
            reply(id: id, result: ["error": "payload must be an object"])
            return
        }

        switch type {
        case "app.ready":
            isBridgeReady = true
            reply(id: id, result: ["status": "ready"])
            flushNativeActions()
        case "notifications.getPermission":
            notificationManager.getPermission { @MainActor [weak self] permission in
                self?.reply(id: id, result: ["permission": permission.rawValue])
            }
        case "notifications.requestPermission":
            notificationManager.requestPermission { @MainActor [weak self] permission, error in
                if let error {
                    self?.reply(id: id, result: ["error": error])
                } else if let permission {
                    self?.reply(id: id, result: ["permission": permission.rawValue])
                } else {
                    self?.reply(id: id, result: ["error": "Permission request did not complete"])
                }
            }
        case "notifications.reconcile":
            do {
                let items = try notificationManager.parseScheduleItems(payload: payload)
                notificationManager.reconcile(items: items) { @MainActor [weak self] outcome in
                    if let error = outcome.error {
                        self?.reply(id: id, result: ["error": error])
                    } else {
                        self?.reply(id: id, result: ["status": "scheduled", "count": outcome.count])
                    }
                }
            } catch {
                reply(id: id, result: ["error": error.localizedDescription])
            }
        case "notifications.test":
            notificationManager.scheduleTest { @MainActor [weak self] error in
                if let error {
                    self?.reply(id: id, result: ["error": error])
                } else {
                    self?.reply(id: id, result: ["status": "scheduled"])
                }
            }
        case "notifications.openSettings":
            if notificationManager.openNotificationSettings() {
                reply(id: id, result: ["status": "opened"])
            } else {
                reply(id: id, result: ["error": "Unable to open notification settings"])
            }
        case "files.save":
            saveFile(id: id, payload: payload)
        default:
            reply(id: id, result: ["error": "Unsupported message type: \(type)"])
        }
    }

    private func reply(id: String, result: [String: Any]) {
        guard let webView = dayflowWebView else { return }
        do {
            let idData = try JSONSerialization.data(withJSONObject: id, options: .fragmentsAllowed)
            let resultData = try JSONSerialization.data(withJSONObject: result)
            guard let idJSON = String(data: idData, encoding: .utf8),
                  let resultJSON = String(data: resultData, encoding: .utf8) else {
                throw NSError(domain: "com.dayflow.app.bridge", code: 1)
            }
            let script = "window.__dayflowNativeResolve(\(idJSON),\(resultJSON));"
            webView.evaluateJavaScript(script) { _, error in
                if let error {
                    NSLog("Dayflow bridge reply failed: \(error.localizedDescription)")
                }
            }
        } catch {
            NSLog("Dayflow bridge response encoding failed: \(error.localizedDescription)")
        }
    }

    private func saveFile(id: String, payload: [String: Any]) {
        guard let filename = payload["filename"] as? String,
              let base64 = payload["base64"] as? String,
              payload["mimeType"] is String else {
            reply(id: id, result: ["error": "filename, base64 and mimeType are required"])
            return
        }
        guard let data = Data(base64Encoded: base64) else {
            reply(id: id, result: ["error": "Invalid base64 data"])
            return
        }

        let panel = NSSavePanel()
        panel.title = "保存文件"
        panel.prompt = "保存"
        panel.nameFieldStringValue = Self.safeFilename(filename)
        panel.canCreateDirectories = true

        let completion: (NSApplication.ModalResponse) -> Void = { [weak self, weak panel] response in
            guard let self else { return }
            guard response == .OK else {
                self.reply(id: id, result: ["saved": false])
                return
            }
            guard let url = panel?.url else {
                self.reply(id: id, result: ["error": "No destination was selected"])
                return
            }
            do {
                try data.write(to: url, options: .atomic)
                self.reply(id: id, result: ["saved": true, "path": url.path])
            } catch {
                self.reply(id: id, result: ["error": error.localizedDescription])
            }
        }

        if let window = view.window {
            panel.beginSheetModal(for: window, completionHandler: completion)
        } else {
            panel.begin(completionHandler: completion)
        }
    }

    private static func safeFilename(_ filename: String) -> String {
        let invalid = CharacterSet(charactersIn: "/\\").union(.controlCharacters)
        var safe = filename.components(separatedBy: invalid).joined(separator: "_")
        safe = safe.trimmingCharacters(in: .whitespacesAndNewlines)
        if safe.isEmpty || safe == "." || safe == ".." {
            safe = "Dayflow-export"
        }
        if safe.count > 240 {
            safe = String(safe.suffix(240))
        }
        return safe
    }
}

@MainActor
private final class ScriptMessageProxy: NSObject, WKScriptMessageHandler {
    private weak var target: DayflowWebViewController?

    init(target: DayflowWebViewController) {
        self.target = target
        super.init()
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        target?.handleScriptMessage(message)
    }
}
