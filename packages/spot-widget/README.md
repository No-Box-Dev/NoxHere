# NoxHere Spot widget

This package owns the browser capture widget served by the NoxHere Spot
capability. The production service loads `noxspot.min.js` and
`noxspot-core.min.js` from the `noxspot-assets` R2 bucket. The
`blindspot.min.js` build is retained only for legacy embed compatibility.

Run `npm test` and `npm run build` before publishing the three generated files.

Applications using the TypeScript SDK can install the site-specific script
through `installNoxHereWidget` from `@noxhere/sdk/widget`. The widget remains a
separate lazy-loaded bundle so it does not inflate the API client's package or
application startup bundle.
