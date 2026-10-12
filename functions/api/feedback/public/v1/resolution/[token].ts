type Context = {
  request: Request;
  env: { FEEDBACK_RESPONSE: Fetcher };
  params: { token: string };
};

export async function onRequestGet(context: Context): Promise<Response> {
  const token = encodeURIComponent(context.params.token);
  return context.env.FEEDBACK_RESPONSE.fetch(
    new Request(`https://feedback.internal/resolution/${token}`, {
      method: "GET",
      headers: context.request.headers,
    }),
  );
}

export function onRequest(): Response {
  return new Response(null, { status: 405, headers: { Allow: "GET" } });
}
