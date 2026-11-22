import AppKit
import Foundation
import UserNotifications

struct NativeAction: Sendable {
    let action: String
    let kind: String
    let entityId: String
    let occurrenceStart: String?

    var jsonObject: [String: Any] {
        var object: [String: Any] = [
            "action": action,
            "kind": kind,
            "entityId": entityId
        ]
        if let occurrenceStart {
            object["occurrenceStart"] = occurrenceStart
        }
        return object
    }
}

enum NotificationPermission: String, Sendable {
    case `default`
    case granted
    case denied
    case unsupported
}

struct ScheduleItem: Sendable {
    enum Kind: String, Sendable {
        case event
        case reminder
    }

    let requestId: String
    let kind: Kind
    let entityId: String
    let title: String
    let body: String
    let fireAt: Double
    let occurrenceStart: String?

    var identifier: String {
        "dayflow.schedule." + Self.sanitize(requestId)
    }

    private static func sanitize(_ value: String) -> String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
        let scalars = value.unicodeScalars.map { scalar -> UnicodeScalar in
            allowed.contains(scalar) ? scalar : "_"
        }
        let cleaned = String(String.UnicodeScalarView(scalars))
        return cleaned.isEmpty ? "item" : cleaned
    }
}

struct ReconcileOutcome: Sendable {
    let count: Int
    let error: String?
}

private final class RevisionCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var revision: UInt64 = 0

    func next() -> UInt64 {
        lock.lock()
        defer { lock.unlock() }
        revision &+= 1
        return revision
    }

    func isCurrent(_ candidate: UInt64) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return revision == candidate
    }
}

private struct SendableNotificationCenter: @unchecked Sendable {
    let center: UNUserNotificationCenter
}

private struct SendableNotificationRequest: @unchecked Sendable {
    let request: UNNotificationRequest
}

private final class PendingRequestsBox: @unchecked Sendable {
    var requests: [UNNotificationRequest] = []
}

private final class NotificationErrorBox: @unchecked Sendable {
    var error: (any Error)?
}

private final class CompletionBox: @unchecked Sendable {
    let completion: () -> Void

    init(_ handler: @escaping () -> Void) {
        self.completion = handler
    }
}

private struct NotificationResponseData: Sendable {
    let actionIdentifier: String
    let requestIdentifier: String
    let categoryIdentifier: String
    let title: String
    let body: String
    let kind: String?
    let entityId: String?
    let requestId: String?
    let occurrenceStart: String?

    init(response: UNNotificationResponse) {
        actionIdentifier = response.actionIdentifier
        let request = response.notification.request
        requestIdentifier = request.identifier
        categoryIdentifier = request.content.categoryIdentifier
        title = request.content.title
        body = request.content.body
        kind = request.content.userInfo["kind"] as? String
        entityId = request.content.userInfo["entityId"] as? String
        requestId = request.content.userInfo["requestId"] as? String
        occurrenceStart = request.content.userInfo["occurrenceStart"] as? String
    }
}

@MainActor
final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    private static let schedulePrefix = "dayflow.schedule."
    private static let snoozeAction = "dayflow.action.snooze"
    private static let completeAction = "dayflow.action.complete"

    private let centerBox = SendableNotificationCenter(center: .current())
    private let revisions = RevisionCounter()
    private let reconcileQueue = DispatchQueue(label: "com.dayflow.app.notifications.reconcile")

    var onNativeAction: ((NativeAction) -> Void)?

    func configure() {
        let center = centerBox.center
        center.delegate = self

        let snooze = UNNotificationAction(
            identifier: Self.snoozeAction,
            title: "稍后 10 分钟",
            options: []
        )
        let complete = UNNotificationAction(
            identifier: Self.completeAction,
            title: "完成",
            options: []
        )
        let event = UNNotificationCategory(
            identifier: ScheduleItem.Kind.event.rawValue,
            actions: [snooze],
            intentIdentifiers: [],
            options: []
        )
        let reminder = UNNotificationCategory(
            identifier: ScheduleItem.Kind.reminder.rawValue,
            actions: [snooze, complete],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([event, reminder])
    }

    func getPermission(completion: @escaping @MainActor @Sendable (NotificationPermission) -> Void) {
        Task { @MainActor in
            let permission = await Self.readPermission(centerBox)
            completion(permission)
        }
    }

    func requestPermission(completion: @escaping @MainActor @Sendable (NotificationPermission?, String?) -> Void) {
        Task { @MainActor in
            do {
                let granted = try await Self.requestAuthorization(centerBox)
                completion(granted ? .granted : .denied, nil)
            } catch {
                completion(nil, error.localizedDescription)
            }
        }
    }

    func parseScheduleItems(payload: [String: Any]) throws -> [ScheduleItem] {
        guard let rawItems = payload["items"] as? [[String: Any]] else {
            throw validationError("items must be an array of objects")
        }

        return try rawItems.enumerated().map { index, item in
            guard let requestId = item["requestId"] as? String, !requestId.isEmpty,
                  let rawKind = item["kind"] as? String,
                  let kind = ScheduleItem.Kind(rawValue: rawKind),
                  let entityId = item["entityId"] as? String,
                  let title = item["title"] as? String,
                  let body = item["body"] as? String,
                  let fireAt = Self.milliseconds(item["fireAt"]),
                  fireAt.isFinite else {
                throw validationError("Invalid notification item at index \(index)")
            }
            let occurrenceStart: String?
            if item["occurrenceStart"] == nil || item["occurrenceStart"] is NSNull {
                occurrenceStart = nil
            } else if let value = item["occurrenceStart"] as? String {
                occurrenceStart = value
            } else {
                throw validationError("occurrenceStart must be a string at index \(index)")
            }
            return ScheduleItem(
                requestId: requestId,
                kind: kind,
                entityId: entityId,
                title: title,
                body: body,
                fireAt: fireAt,
                occurrenceStart: occurrenceStart
            )
        }
    }

    func reconcile(items: [ScheduleItem], completion: @escaping @MainActor @Sendable (ReconcileOutcome) -> Void) {
        let revision = revisions.next()
        let centerBox = self.centerBox
        let revisions = self.revisions
        let schedulePrefix = Self.schedulePrefix

        reconcileQueue.async {
            func finish(_ outcome: ReconcileOutcome) {
                Task { @MainActor in
                    completion(outcome)
                }
            }

            guard revisions.isCurrent(revision) else {
                finish(ReconcileOutcome(count: 0, error: "Reconciliation superseded"))
                return
            }

            let pendingBox = PendingRequestsBox()
            let pendingSemaphore = DispatchSemaphore(value: 0)
            centerBox.center.getPendingNotificationRequests { requests in
                pendingBox.requests = requests
                pendingSemaphore.signal()
            }
            guard pendingSemaphore.wait(timeout: .now() + 10) == .success else {
                finish(ReconcileOutcome(count: 0, error: "Unable to read pending notifications"))
                return
            }

            let identifiers = pendingBox.requests.map(\.identifier).filter {
                $0.hasPrefix(schedulePrefix)
            }
            centerBox.center.removePendingNotificationRequests(withIdentifiers: identifiers)

            guard revisions.isCurrent(revision) else {
                finish(ReconcileOutcome(count: 0, error: "Reconciliation superseded"))
                return
            }

            let uniqueItems = Dictionary(items.map { ($0.identifier, $0) }) { _, new in new }
            let nowMilliseconds = Date().timeIntervalSince1970 * 1000
            var scheduledCount = 0

            for item in uniqueItems.values.sorted(by: { $0.identifier < $1.identifier }) {
                guard revisions.isCurrent(revision) else {
                    finish(ReconcileOutcome(count: 0, error: "Reconciliation superseded"))
                    return
                }
                guard item.fireAt > nowMilliseconds else { continue }

                let content = UNMutableNotificationContent()
                content.title = item.title
                content.body = item.body
                content.sound = .default
                content.categoryIdentifier = item.kind.rawValue
                var userInfo: [String: Any] = [
                    "kind": item.kind.rawValue,
                    "entityId": item.entityId,
                    "requestId": item.requestId
                ]
                if let occurrenceStart = item.occurrenceStart {
                    userInfo["occurrenceStart"] = occurrenceStart
                }
                content.userInfo = userInfo

                let interval = (item.fireAt - nowMilliseconds) / 1000
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
                let request = UNNotificationRequest(
                    identifier: item.identifier,
                    content: content,
                    trigger: trigger
                )

                let errorBox = NotificationErrorBox()
                let addSemaphore = DispatchSemaphore(value: 0)
                centerBox.center.add(request) { error in
                    errorBox.error = error
                    addSemaphore.signal()
                }
                guard addSemaphore.wait(timeout: .now() + 10) == .success else {
                    finish(ReconcileOutcome(count: 0, error: "Notification scheduling timed out"))
                    return
                }
                if let error = errorBox.error {
                    finish(ReconcileOutcome(count: 0, error: error.localizedDescription))
                    return
                }
                scheduledCount += 1
            }

            guard revisions.isCurrent(revision) else {
                finish(ReconcileOutcome(count: 0, error: "Reconciliation superseded"))
                return
            }
            finish(ReconcileOutcome(count: scheduledCount, error: nil))
        }
    }

    func scheduleTest(completion: @escaping @MainActor @Sendable (String?) -> Void) {
        let content = UNMutableNotificationContent()
        content.title = "Dayflow"
        content.body = "通知工作正常。重要的事，会准时提醒你。"
        content.sound = .default
        content.categoryIdentifier = ScheduleItem.Kind.event.rawValue

        let request = UNNotificationRequest(
            identifier: "dayflow.test.\(UUID().uuidString)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false)
        )
        let requestBox = SendableNotificationRequest(request: request)
        Task { @MainActor in
            do {
                try await Self.add(requestBox, to: centerBox)
                completion(nil)
            } catch {
                completion(error.localizedDescription)
            }
        }
    }

    func openNotificationSettings() -> Bool {
        let urls = [
            "x-apple.systempreferences:com.apple.Notifications-Settings.extension",
            "x-apple.systempreferences:com.apple.preference.notifications"
        ]
        for value in urls {
            if let url = URL(string: value), NSWorkspace.shared.open(url) {
                return true
            }
        }
        return false
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let data = NotificationResponseData(response: response)
        let completion = CompletionBox(completionHandler)
        Task { @MainActor in
            self.handle(response: data)
            completion.completion()
        }
    }

    private func handle(response: NotificationResponseData) {
        switch response.actionIdentifier {
        case Self.snoozeAction:
            handleSnooze(response)
        case Self.completeAction:
            guard response.kind == ScheduleItem.Kind.reminder.rawValue,
                  let kind = response.kind,
                  let entityId = response.entityId else { return }
            removeDelivered(response.requestIdentifier)
            activateApp()
            onNativeAction?(NativeAction(
                action: "complete",
                kind: kind,
                entityId: entityId,
                occurrenceStart: response.occurrenceStart
            ))
        case UNNotificationDefaultActionIdentifier:
            removeDelivered(response.requestIdentifier)
            activateApp()
            guard let kind = response.kind, let entityId = response.entityId else { return }
            onNativeAction?(NativeAction(
                action: "open",
                kind: kind,
                entityId: entityId,
                occurrenceStart: response.occurrenceStart
            ))
        default:
            break
        }
    }

    private func handleSnooze(_ response: NotificationResponseData) {
        centerBox.center.removeDeliveredNotifications(withIdentifiers: [response.requestIdentifier])

        let content = UNMutableNotificationContent()
        content.title = response.title
        content.body = response.body
        content.sound = .default
        content.categoryIdentifier = response.categoryIdentifier
        var userInfo: [String: Any] = [:]
        if let kind = response.kind { userInfo["kind"] = kind }
        if let entityId = response.entityId { userInfo["entityId"] = entityId }
        if let requestId = response.requestId { userInfo["requestId"] = requestId }
        if let occurrenceStart = response.occurrenceStart { userInfo["occurrenceStart"] = occurrenceStart }
        content.userInfo = userInfo

        let request = UNNotificationRequest(
            identifier: "dayflow.snooze.\(UUID().uuidString)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 600, repeats: false)
        )
        let requestBox = SendableNotificationRequest(request: request)
        Task { @MainActor in
            do {
                try await Self.add(requestBox, to: centerBox)
            } catch {
                NSLog("Dayflow snooze scheduling failed: \(error.localizedDescription)")
            }
        }
    }

    private func removeDelivered(_ identifier: String) {
        centerBox.center.removeDeliveredNotifications(withIdentifiers: [identifier])
    }

    private func activateApp() {
        let application = NSApplication.shared
        if #available(macOS 14.0, *) {
            application.activate()
        } else {
            application.activate(ignoringOtherApps: true)
        }
        if let window = application.windows.first {
            if window.isMiniaturized {
                window.deminiaturize(nil)
            }
            window.makeKeyAndOrderFront(nil)
        }
    }

    private nonisolated static func readPermission(
        _ centerBox: SendableNotificationCenter
    ) async -> NotificationPermission {
        let settings = await centerBox.center.notificationSettings()
        return permission(for: settings.authorizationStatus)
    }

    private nonisolated static func requestAuthorization(
        _ centerBox: SendableNotificationCenter
    ) async throws -> Bool {
        try await centerBox.center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    private nonisolated static func add(
        _ requestBox: SendableNotificationRequest,
        to centerBox: SendableNotificationCenter
    ) async throws {
        try await centerBox.center.add(requestBox.request)
    }

    private nonisolated static func permission(for status: UNAuthorizationStatus) -> NotificationPermission {
        switch status {
        case .notDetermined:
            return .default
        case .denied:
            return .denied
        case .authorized, .provisional:
            return .granted
        @unknown default:
            return .unsupported
        }
    }

    private static func milliseconds(_ value: Any?) -> Double? {
        if let value = value as? Double { return value }
        if let value = value as? Int { return Double(value) }
        if let value = value as? NSNumber { return value.doubleValue }
        return nil
    }

    private func validationError(_ description: String) -> NSError {
        NSError(
            domain: "com.dayflow.app.notifications",
            code: 400,
            userInfo: [NSLocalizedDescriptionKey: description]
        )
    }
}
