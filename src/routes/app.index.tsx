import { createFileRoute } from "@tanstack/react-router";
import { DashboardHome } from "@/components/skinscan/dashboard-home";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Inicio — SkinScan" }] }),
  component: DashboardHome,
});
