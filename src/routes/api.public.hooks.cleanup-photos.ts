import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/cleanup-photos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { error, count } = await supabaseAdmin
          .from("photos")
          .update({ status: "deleted", deleted_at: new Date().toISOString() }, { count: "exact" })
          .eq("status", "available")
          .lt("taken_at", cutoff);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, expired: count ?? 0 });
      },
    },
  },
});
