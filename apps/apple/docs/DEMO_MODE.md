# NoxHere demo mode

Demo mode is a first-class, read-only NoxHere session for App Review and product evaluation. It uses the production macOS interface against an isolated Cloudflare Worker and a dedicated D1 database. It never authenticates with GitHub, never selects a real NoxHere organization, and never writes to customer data.

## Session boundary

| Concern | Production | Demo |
| --- | --- | --- |
| Entry | GitHub OAuth Device Flow in `ASWebAuthenticationSession` | One-click **Explore Demo** |
| Identity | GitHub account stored in the macOS Keychain | Short-lived backend session held in memory |
| API | `https://app.noxhere.com/api/v1` | Isolated `noxhere-response` demo API with the same versioned paths |
| Organization | User-selected GitHub organization | Seeded `NoxHere-Demo` organization |
| Data | Live NoxHere organization data | Immutable seeded D1 content with relative display times |
| Writes | Controlled by normal membership/admin permissions | Rejected by the backend with `demo_read_only` |
| Exit | Sign out removes that account's Keychain credentials | Exit Demo discards only the in-memory demo session |

Production accounts remain in `AccountsStore` while demo mode is active. Entering demo does not insert a fake GitHub account, write a demo token to Keychain, or modify the production account selection. Exiting demo resumes an existing production session when one was already present.

## Complete feature inventory

| Feature | Demo behavior |
| --- | --- |
| Current, Opened, Merged, Notes | Enabled with seeded content matching the production navigation |
| Feed pagination / Load more | Enabled; demo pages are deliberately small so pagination is visible |
| Person and repository filters | Enabled |
| Me filter | Enabled for `reviewer-demo` |
| Current team overview | Enabled with 12 seeded members and deliberately uneven workload counts |
| Person drill-down | Enabled with open PRs, drafts, review requests, and assigned issues |
| PR detail and timeline | Enabled with opened, pushed, reviewed, and merged activity |
| Copy link / open GitHub | Enabled and points to public example GitHub pages |
| Manual refresh | Enabled; seeded content remains unchanged |
| Notification settings | Enabled |
| Test notification | Enabled and uses the normal macOS notification path |
| Live notification polling | Enabled but produces no new activity because event IDs are immutable |
| Global shortcut | Enabled |
| Account and organization menu | Visible with the demo identity and organization |
| Add another account | Visible and disabled with an unavailable-in-demo label |
| Manage AI provider | Visible and disabled |
| Manage tracked repositories | Visible and disabled |
| Manage team visibility | Visible and disabled |
| Trigger sync / force full re-sync | Visible and disabled |
| Quit | Enabled |
| Exit Demo | Enabled; returns to production sign-in or the prior production account |

## Backend guarantees

- Demo content and sessions live in the separate `noxhere-demo` D1 database.
- Session tokens are random, stored only as SHA-256 hashes, expire after 24 hours, and are never persisted by the macOS app.
- Expired sessions are removed when a new demo begins, and retained sessions are bounded.
- Every non-GET demo API request is rejected even if the client UI is modified.
- The demo API cannot choose a production organization and has no binding to the production NoxHere database.
- Responses use `Cache-Control: no-store` and do not include customer data.

## Seed maintenance

The fixture is an anonymized miniature of a busy NoxHere organization: 12 members, 12 repositories, 50 open PRs (including eight drafts), 24 recent merges, 72 assigned issues, and 365 feed/timeline events. No production organization names, people, titles, URLs, or payloads are copied into it.

The content rows do not update during use. Relative ages are calculated when data is returned so the review workspace continues to look current without mutating the seeded records. Content changes require an explicit D1 migration.
