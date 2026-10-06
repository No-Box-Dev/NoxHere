// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NoxHere",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [.library(name: "NoxHere", targets: ["NoxHere"])],
    targets: [
        .target(name: "NoxHere"),
        .testTarget(name: "NoxHereTests", dependencies: ["NoxHere"]),
    ]
)
