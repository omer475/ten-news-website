import Foundation
import Security

final class KeychainManager: @unchecked Sendable {
    static let shared = KeychainManager()

    private let serviceName = "ai.tennews.app"

    private enum Keys {
        static let accessToken = "access_token"
        static let refreshToken = "refresh_token"
        static let sessionData = "session_data"
    }

    private init() {}

    // MARK: - Access Token

    var accessToken: String? {
        get { read(key: Keys.accessToken) }
        set {
            if let value = newValue {
                save(key: Keys.accessToken, value: value)
            } else {
                delete(key: Keys.accessToken)
            }
        }
    }

    // MARK: - Refresh Token

    var refreshToken: String? {
        get { read(key: Keys.refreshToken) }
        set {
            if let value = newValue {
                save(key: Keys.refreshToken, value: value)
            } else {
                delete(key: Keys.refreshToken)
            }
        }
    }

    // MARK: - Session Data

    var sessionData: Data? {
        get { readData(key: Keys.sessionData) }
        set {
            if let value = newValue {
                saveData(key: Keys.sessionData, data: value)
            } else {
                delete(key: Keys.sessionData)
            }
        }
    }

    // MARK: - Clear All

    func clearAll() {
        delete(key: Keys.accessToken)
        delete(key: Keys.refreshToken)
        delete(key: Keys.sessionData)
    }

    // MARK: - Private Helpers

    private func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        saveData(key: key, data: data)
    }

    private func read(key: String) -> String? {
        guard let data = readData(key: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func saveData(key: String, data: Data) {
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    private func readData(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}
