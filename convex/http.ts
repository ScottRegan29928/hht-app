import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

// ── iCal export endpoint ──
// GET /api/calendar/:weekId.ics
http.route({
  path: "/api/calendar",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const weekId = url.searchParams.get("weekId");

    if (!weekId) {
      return new Response("Missing weekId parameter", { status: 400 });
    }

    try {
      const icalContent = await ctx.runQuery(api.calendar.generateIcal, {
        weekId: weekId as any,
      });

      if (!icalContent) {
        return new Response("Week not found", { status: 404 });
      }

      return new Response(icalContent, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="week-${weekId}.ics"`,
          "Cache-Control": "no-cache, max-age=0",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err: any) {
      return new Response("Error generating calendar", { status: 500 });
    }
  }),
});

export default http;
