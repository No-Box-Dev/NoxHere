const MAX_ERROR_BYTES = 64 * 1024;
const ERROR_READ_TIMEOUT_MS = 1_000;

/** Inspect only a bounded clone; preserve the original response for its caller.
 * Never await tee cancellation: it can wait for the caller's branch to finish.
 */
export async function boundedErrorCode(response: Response, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) return "unknown";
  const declared = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_ERROR_BYTES) return "response_too_large";
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let stopped = false;
  const stop = () => {
    stopped = true;
    void reader?.cancel().catch(() => {});
  };
  const timer = setTimeout(stop, ERROR_READ_TIMEOUT_MS);
  signal?.addEventListener("abort", stop, { once: true });
  try {
    reader = response.clone().body?.getReader();
    if (!reader) return "unknown";
    if (signal?.aborted) stop();
    const decoder = new TextDecoder();
    let size = 0;
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (stopped) return "unknown";
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ERROR_BYTES) return "response_too_large";
      text += decoder.decode(value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode()) as { error?: { code?: unknown } };
    return typeof body.error?.code === "string" ? body.error.code : "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
    stop();
    reader?.releaseLock();
  }
}
