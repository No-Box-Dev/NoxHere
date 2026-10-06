# NoxHere Swift SDK

Internal-first Swift Package for native NoxHere clients. Its operation catalog
is generated from the same checked OpenAPI artifact as the TypeScript and
Python SDKs.

```swift
import NoxHere

let nox = NoxHereClient(token: token, projectID: "project-1")
let projects = try await nox.request("listProjects")
```

The first release intentionally exposes a small, stable async transport and a
generated operation catalog. It is built and tested in CI but is not yet
published to a public Swift registry. Add it as a local package from
`packages/swift-sdk` while the native API is being validated.
