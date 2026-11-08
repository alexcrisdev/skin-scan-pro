import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/presentacion")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
