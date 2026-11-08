import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/skinscan/landing-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkinScan — Análisis preliminar de lesiones cutáneas" },
      {
        name: "description",
        content:
          "Conoce SkinScan: análisis preliminar de lesiones cutáneas con inteligencia artificial, historial personal y seguimiento de tu piel.",
      },
    ],
  }),
  component: LandingPage,
});
