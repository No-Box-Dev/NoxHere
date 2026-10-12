import KeyboardShortcuts

/// Global keyboard shortcuts this app registers. Users can rebind later
/// through a Settings surface; the default is chosen to be left-hand-only
/// and to avoid the common Chrome / macOS chords.
extension KeyboardShortcuts.Name {
    /// Toggle the menubar popover. Default ⌘⇧X — Chrome doesn't bind it,
    /// left-hand reachable (cmd + shift + X), no macOS system claim.
    static let toggleFeed = Self("toggleFeed", default: .init(.x, modifiers: [.command, .shift]))
}
