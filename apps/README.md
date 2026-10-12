# NoxHere applications

Applications are user-facing clients. They consume NoxHere service contracts
but do not own provider credentials or service business logic.

| Application | Responsibility |
| --- | --- |
| `web` | Canonical NoxHere browser application deployed with Gateway |
| `cli` | Command-line client and local-agent session integration |

The native macOS, iPhone, and iPad targets live in the separate
[`No-Box-Dev/NoxHere-Apple`](https://github.com/No-Box-Dev/NoxHere-Apple)
repository. That repository owns Xcode, signing, TestFlight, and App Store
releases while consuming the unified NoxHere API. NoxKey also remains a
separate product and repository.
