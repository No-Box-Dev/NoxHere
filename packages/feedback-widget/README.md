# NoxHere feedback widget

This package owns the independently built browser capture client for NoxHere's
Feedback capability. The public browser API remains named `Feedback` for embed
compatibility. The production service loads `feedback.min.js` and
`feedback-core.min.js` from the `feedback-assets` R2 bucket.

Run `npm test` and `npm run build` before publishing the two generated files.

Applications using the TypeScript SDK can install the site-specific script
through `installNoxHereWidget` from `@noxhere/sdk/widget`. The widget remains a
separate lazy-loaded bundle so it does not inflate the API client's package or
application startup bundle.

## Launcher configuration

The site configuration keeps desktop and mobile launcher behavior independent:

```json
{
  "launcher": {
    "desktop": { "style": "tab", "position": "center-right" },
    "mobile": { "style": "button", "position": "bottom-right" }
  }
}
```

`style` accepts `tab` or `button`. `position` accepts `top-left`,
`center-left`, `bottom-left`, `top-right`, `center-right`, or `bottom-right`.
The values above are the backward-compatible defaults. Administrators can
change them in Feedback → Widgets, and agents can update the same structure
through `PATCH /api/v1/feedback/sites/{siteId}`.
