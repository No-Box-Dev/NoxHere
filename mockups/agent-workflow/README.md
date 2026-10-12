# Unticket agent workflow mock

A standalone, dependency-free prototype for integrating agent execution into
Unticket's existing Features board.

Open `index.html` directly in a browser, or serve this directory with any
static file server.

## Interactions

- Click a feature card to open its detail drawer.
- Click a card's latest-action row to see its titled event history.
- Switch between Agent work, Spec, and Activity in the drawer.
- Switch the change review between Files and Diff.
- Try Add task, Stop, Send feedback, and Review & open PR.

Everything is sample data held in the page. It does not call Unticket or
GitHub and does not modify the macOS application.
