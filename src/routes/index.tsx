import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MELANO INC — Acceso al Command Center" },
      {
        name: "description",
        content:
          "Acceso privado al Autonomous Command Center de MELANO INC con email o cuenta de Google.",
      },
      { property: "og:title", content: "MELANO INC — Autonomous Command Center" },
      {
        property: "og:description",
        content: "AI. Automation. Impact. Equipo ejecutivo digital con trazabilidad real.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});
