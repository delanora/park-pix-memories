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

        // 1) Expire purchased photos older than 45 days from purchase date
        const { data: expiredPurchased, error: rpcErr } = await supabaseAdmin.rpc(
          "expire_purchased_photos",
          { _days: 45 },
        );
        if (rpcErr) {
          return Response.json({ error: rpcErr.message }, { status: 500 });
        }

        return Response.json({
          ok: true,
          expiredPurchased: expiredPurchased ?? 0,
        });
      },
    },
  },
});
