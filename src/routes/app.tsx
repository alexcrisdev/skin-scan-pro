import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/skinscan/app-layout";
export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Panel — SkinScan" }] }),
  component: AppLayout,
});
