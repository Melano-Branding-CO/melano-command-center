import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MELANO INC — COMMAND CENTER" },
      {
        name: "description",
        content: "Acceso privado al Command Center de MELANO INC con email o cuenta de Google.",
      },
      { property: "og:title", content: "MELANO INC — COMMAND CENTER" },
      {
        property: "og:description",
        content: "AI. Automation. Impact. Equipo ejecutivo digital con trazabilidad real.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});
