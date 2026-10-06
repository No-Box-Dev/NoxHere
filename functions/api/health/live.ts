export function onRequestGet(): Response {
  return Response.json(
    { service: "noxhere", status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
