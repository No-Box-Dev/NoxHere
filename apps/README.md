# NoxHere applications

Applications are user-facing clients. They consume NoxHere service contracts
but do not own provider credentials or service business logic.

| Application | Responsibility |
| --- | --- |
| `web` | Canonical NoxHere browser application deployed with Gateway |
| `cli` | Command-line client and local-agent session integration |
| `apple` | Native NoxHere client for macOS, iPhone, and iPad |

The Apple client keeps its independent Xcode, signing, TestFlight, and App Store
release lifecycle inside `apps/apple`; it shares the unified API and repository.
NoxKey remains a separate product and repository.
