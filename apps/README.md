# NoxHere applications

Applications are user-facing clients. They consume NoxHere service contracts
but do not own provider credentials or service business logic.

| Application | Responsibility |
| --- | --- |
| `web` | Canonical NoxHere browser application deployed with Gateway |
| `cli` | Command-line client and local-agent session integration |

The native Apple client remains a separate repository because its Xcode,
signing, TestFlight, and App Store lifecycle is independent. Use
`noxhere-apple` as the repository name and `NoxHere` as the app name; avoid a
service name such as `NoxFeedApp`, because Feed is now one capability inside
NoxHere. NoxKey also remains a separate product and repository.
