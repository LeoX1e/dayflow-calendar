import AppKit

@MainActor
func dayflowDiagnostic(_ message: String) {
    guard ProcessInfo.processInfo.environment["DAYFLOW_DIAGNOSTICS"] == "1" else { return }
    NSLog("Dayflow diagnostic: \(message)")
}

@MainActor
func runDayflowApplication() {
    dayflowDiagnostic("main entered")
    let application = NSApplication.shared
    dayflowDiagnostic("NSApplication.shared returned")
    let delegate = AppDelegate()
    dayflowDiagnostic("AppDelegate initialized")
    application.delegate = delegate
    application.setActivationPolicy(.regular)
    dayflowDiagnostic("entering NSApplication.run")
    withExtendedLifetime(delegate) {
        application.run()
    }
    dayflowDiagnostic("NSApplication.run returned")
}

runDayflowApplication()
