# NoxHere onboarding

NoxHere guides a new user through three short steps:

1. **Sign in.** NoxHere opens GitHub with ASWebAuthenticationSession, copies the device code, and waits for approval.
2. **Connect a team.** NoxHere loads the user's GitHub organizations. If none exist, it opens GitHub's organization page. If NoxConnect is missing, it opens the GitHub App install page.
3. **Open Activity.** NoxHere confirms the organization link and explains Current, Opened, Merged, and Notes.

The setup popover opens on a fresh launch because NoxHere has no Dock window. GitHub and NoxConnect checks run again when the user returns. After the GitHub App page opens, NoxHere also polls for the link and moves on as soon as it is ready.

## Recovery paths

- GitHub sign-in fails: return to the welcome page with a clear error and retry.
- Organizations fail to load: retry or sign out and start again.
- No organization exists: create one or accept an invite, then check again.
- NoxConnect is not linked: install it, wait for the automatic check, or check now.
- Demo fails to load: keep the user on the welcome page and allow retry.

Setup completion is saved per GitHub account and organization. A new organization gets its own setup summary. Demo setup is kept only for the current app session.

## Verification

OnboardingFlowTests covers every route from fresh install to returning user and locks the main copy to a Flesch Reading Ease score of 80–90. OnboardingSnapshotTests renders all five setup pages at the production 570×780 popover size.

Use --onboarding-preview-welcome for a local welcome-page run. Use --start-demo for the live read-only demo handoff.
