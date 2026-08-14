export const CANARY_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NoxAlert canary</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #090b10; color: #f4f6fb; }
    main { width: min(560px, calc(100vw - 40px)); padding: 32px; border: 1px solid #293041; border-radius: 18px; background: #111621; box-shadow: 0 24px 80px #0008; }
    h1 { margin: 0 0 10px; font-size: 28px; }
    p { color: #aab3c5; line-height: 1.55; }
    label { display: grid; gap: 8px; margin: 24px 0 16px; font-weight: 650; }
    input { border: 1px solid #384157; border-radius: 10px; padding: 12px 14px; background: #090c13; color: inherit; font: inherit; }
    button { width: 100%; border: 0; border-radius: 10px; padding: 13px 16px; background: #ff684f; color: #160603; font: inherit; font-weight: 800; cursor: pointer; }
    button:disabled { cursor: wait; opacity: .55; }
    pre { min-height: 56px; margin: 18px 0 0; padding: 14px; border-radius: 10px; background: #090c13; color: #9fe7b0; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <main>
    <h1>NoxAlert canary</h1>
    <p>This page deliberately throws a browser error, stages a durable Nox delivery, and asks Unticket's queue consumer to post it to NoBoxDev Slack.</p>
    <label>Canary token <input id="token" type="password" autocomplete="off" spellcheck="false"></label>
    <button id="trigger">Trigger synthetic error</button>
    <pre id="status">Ready.</pre>
  </main>
  <script>
    const button = document.querySelector('#trigger');
    const tokenInput = document.querySelector('#token');
    const status = document.querySelector('#status');
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function poll(deliveryId, token) {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await sleep(1500);
        const response = await fetch('/api/canary/' + encodeURIComponent(deliveryId), {
          headers: { Authorization: 'Bearer ' + token },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Status request failed');
        status.textContent = 'Delivery ' + deliveryId + '\nStatus: ' + result.status
          + (result.errorCode ? '\nError: ' + result.errorCode : '');
        if (result.status === 'delivered') return;
        if (['blocked_configuration', 'failed'].includes(result.status)) {
          throw new Error('Delivery stopped: ' + (result.errorCode || result.status));
        }
      }
      throw new Error('Timed out waiting for Slack delivery');
    }

    button.addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      if (!token) { status.textContent = 'Enter the canary token first.'; return; }
      button.disabled = true;
      try {
        throw new Error('Mock checkout failed while charging the test card');
      } catch (mockError) {
        try {
          status.textContent = 'Submitting synthetic error…';
          const response = await fetch('/api/canary', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: 'noxalert-mock-page', message: mockError.message }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Canary request failed');
          status.textContent = 'Queued delivery ' + result.deliveryId + '…';
          await poll(result.deliveryId, token);
          status.textContent += '\nSlack delivery confirmed.';
        } catch (error) {
          status.textContent += '\n' + (error instanceof Error ? error.message : String(error));
        }
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;

export const CANARY_PAGE_HEADERS: HeadersInit = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
