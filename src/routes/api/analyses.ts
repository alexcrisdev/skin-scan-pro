import { createFileRoute } from "@tanstack/react-router";

import { AnalysisController } from "@/services/analysis/analysis.controller";
import { getSupabaseAdminClient } from "@/lib/supabase.server";

async function getController() {
  const supabase = await getSupabaseAdminClient();
  return AnalysisController.fromSupabaseClient(supabase);
}

export const Route = createFileRoute("/api/analyses")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const controller = await getController();
        return controller.create({ request });
      },
    },
  },
});
