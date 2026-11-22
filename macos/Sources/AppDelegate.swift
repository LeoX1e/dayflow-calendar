import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private static let windowAutosaveName = "DayflowMainWindow"

    private let notificationManager = NotificationManager()
    private var mainWindow: NSWindow?
    private var webViewController: DayflowWebViewController?
    private var pendingExternalURL: URL?

    func applicationWillFinishLaunching(_ notification: Notification) {
        dayflowDiagnostic("applicationWillFinishLaunching entered")
        NSApplication.shared.setActivationPolicy(.regular)
        installMainMenu()
        dayflowDiagnostic("main menu installed; configuring notifications")
        notificationManager.configure()
        dayflowDiagnostic("notifications configured")

        let controller = DayflowWebViewController(notificationManager: notificationManager)
        notificationManager.onNativeAction = { [weak controller] action in
            controller?.dispatchNativeAction(action)
        }
        webViewController = controller
        dayflowDiagnostic("applicationWillFinishLaunching completed")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        dayflowDiagnostic("applicationDidFinishLaunching entered")
        guard let webViewController else {
            dayflowDiagnostic("missing web view controller")
            return
        }

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Dayflow"
        window.titleVisibility = .visible
        window.titlebarAppearsTransparent = false
        window.contentMinSize = NSSize(width: 980, height: 680)
        window.backgroundColor = .windowBackgroundColor
        window.isReleasedWhenClosed = false
        window.delegate = self
        dayflowDiagnostic("assigning window content view controller")
        window.contentViewController = webViewController
        window.center()
        _ = window.setFrameUsingName(Self.windowAutosaveName)
        window.setFrameAutosaveName(Self.windowAutosaveName)
        dayflowDiagnostic("calling makeKeyAndOrderFront")
        window.makeKeyAndOrderFront(nil)
        mainWindow = window
        dayflowDiagnostic("window created; visible=\(window.isVisible), frame=\(NSStringFromRect(window.frame))")

        if let pendingExternalURL {
            self.pendingExternalURL = nil
            webViewController.loadExternalURL(pendingExternalURL)
        } else {
            webViewController.loadInitialApp()
        }
        dayflowDiagnostic("applicationDidFinishLaunching completed")
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        guard let url = urls.last(where: { $0.scheme?.lowercased() == "dayflow" }) else {
            return
        }

        guard let webViewController, mainWindow != nil else {
            pendingExternalURL = url
            return
        }
        webViewController.loadExternalURL(url)
    }

    func applicationShouldHandleReopen(_ application: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if let mainWindow {
            if mainWindow.isMiniaturized {
                mainWindow.deminiaturize(nil)
            }
            mainWindow.makeKeyAndOrderFront(nil)
        }
        return false
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ application: NSApplication) -> Bool {
        true
    }

    private func installMainMenu() {
        let mainMenu = NSMenu(title: "Main Menu")

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu(title: "Dayflow")
        appMenu.addItem(withTitle: "关于 Dayflow", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "隐藏 Dayflow", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "隐藏其他", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "全部显示", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出 Dayflow", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "窗口")
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.zoom(_:)), keyEquivalent: "")
        windowMenu.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowMenu.addItem(.separator())
        windowMenu.addItem(withTitle: "全部置于前台", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)

        NSApplication.shared.mainMenu = mainMenu
        NSApplication.shared.windowsMenu = windowMenu
    }
}
