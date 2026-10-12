import AppKit
import SwiftUI

/// Shared Nox product-family theme. These values intentionally match the
/// current NoxKey dogfood build: warm stone in light mode, layered charcoal
/// in dark mode, coral for interaction, and violet reserved for identity.
enum UT {
    private static func adaptive(light: NSColor, dark: NSColor) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light
        })
    }

    // NoxKey keeps the dark hierarchy deliberately close together: the
    // shell is charcoal, cards are only one step lighter, and borders do the
    // separation. Opaque colors also avoid the muddy desktop bleed-through
    // that the old translucent surfaces produced in a menu-bar window.
    static let surface = adaptive(
        light: NSColor(srgbRed: 250/255, green: 250/255, blue: 249/255, alpha: 1),
        dark: NSColor(srgbRed: 32/255, green: 32/255, blue: 36/255, alpha: 1)
    )
    static let card = adaptive(
        light: .white,
        dark: NSColor(srgbRed: 36/255, green: 36/255, blue: 40/255, alpha: 1)
    )
    static let border = adaptive(
        light: NSColor(srgbRed: 231/255, green: 229/255, blue: 228/255, alpha: 1),
        dark: NSColor.white.withAlphaComponent(0.12)
    )
    static let borderSoft = adaptive(
        light: NSColor(srgbRed: 245/255, green: 245/255, blue: 244/255, alpha: 1),
        dark: NSColor.white.withAlphaComponent(0.07)
    )

    static let textPrimary = adaptive(
        light: NSColor(srgbRed: 28/255, green: 25/255, blue: 23/255, alpha: 1),
        dark: NSColor.white.withAlphaComponent(0.94)
    )
    static let textBody = adaptive(
        light: NSColor(srgbRed: 41/255, green: 37/255, blue: 36/255, alpha: 1),
        dark: NSColor.white.withAlphaComponent(0.84)
    )
    static let textMuted = adaptive(
        light: NSColor(srgbRed: 120/255, green: 113/255, blue: 108/255, alpha: 1),
        dark: NSColor.white.withAlphaComponent(0.58)
    )
    static let textTertiary = adaptive(
        light: NSColor(srgbRed: 168/255, green: 162/255, blue: 158/255, alpha: 1),
        dark: NSColor.white.withAlphaComponent(0.40)
    )

    // Nox family identity: coral #EF7974, with the icon gradient ending at
    // violet #9B78F4. Primary labels use the family's pale coral on the
    // deeper action fill instead of a harsh black or pure white.
    static let accent = Color(red: 239/255, green: 121/255, blue: 116/255)
    static let accentSoft = adaptive(
        light: NSColor(srgbRed: 253/255, green: 239/255, blue: 238/255, alpha: 1),
        dark: NSColor(srgbRed: 239/255, green: 121/255, blue: 116/255, alpha: 0.14)
    )
    static let onAccent = Color(red: 253/255, green: 239/255, blue: 238/255)
    static let coral = Color(red: 254/255, green: 121/255, blue: 93/255)
    static let violet = Color(red: 155/255, green: 120/255, blue: 244/255)
    static let brandGradient = LinearGradient(
        colors: [coral, violet], startPoint: .topLeading, endPoint: .bottomTrailing
    )

    // Status surfaces also adapt; fixed pale pills disappear on dark cards.
    static let warnBorder = adaptive(
        light: NSColor(srgbRed: 252/255, green: 211/255, blue: 77/255, alpha: 1),
        dark: NSColor.systemOrange.withAlphaComponent(0.42)
    )
    static let warnBg = adaptive(
        light: NSColor(srgbRed: 255/255, green: 251/255, blue: 235/255, alpha: 1),
        dark: NSColor.systemOrange.withAlphaComponent(0.14)
    )
    static let warnText = adaptive(
        light: NSColor(srgbRed: 146/255, green: 64/255, blue: 14/255, alpha: 1),
        dark: NSColor.systemOrange
    )
    static let successBorder = adaptive(
        light: NSColor(srgbRed: 157/255, green: 196/255, blue: 167/255, alpha: 1),
        dark: NSColor.systemGreen.withAlphaComponent(0.42)
    )
    static let successBg = adaptive(
        light: NSColor(srgbRed: 236/255, green: 246/255, blue: 239/255, alpha: 1),
        dark: NSColor.systemGreen.withAlphaComponent(0.14)
    )
    static let successText = adaptive(
        light: NSColor(srgbRed: 47/255, green: 106/255, blue: 68/255, alpha: 1),
        dark: NSColor.systemGreen
    )
    static let bronzeBorder = adaptive(
        light: NSColor(srgbRed: 213/255, green: 177/255, blue: 122/255, alpha: 1),
        dark: NSColor.systemBrown.withAlphaComponent(0.52)
    )
    static let bronzeBg = adaptive(
        light: NSColor(srgbRed: 250/255, green: 241/255, blue: 224/255, alpha: 1),
        dark: NSColor.systemBrown.withAlphaComponent(0.17)
    )
    static let bronzeText = adaptive(
        light: NSColor(srgbRed: 138/255, green: 90/255, blue: 26/255, alpha: 1),
        dark: NSColor(srgbRed: 226/255, green: 177/255, blue: 111/255, alpha: 1)
    )
}

extension Color {
    /// 0xRRGGBB convenience for non-theme model colors.
    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xff) / 255.0
        let g = Double((hex >> 8) & 0xff) / 255.0
        let b = Double(hex & 0xff) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
