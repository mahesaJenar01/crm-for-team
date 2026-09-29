export function GET() {
  return Response.json({
    service: "crm-for-team-api",
    status: "ok",
    time: new Date().toISOString()
  });
}
