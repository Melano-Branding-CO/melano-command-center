import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTodayPriorities from "./tools/list-today-priorities";
import listTasks from "./tools/list-tasks";
import createTask from "./tools/create-task";
import listPendingApprovals from "./tools/list-pending-approvals";
import listAgents from "./tools/list-agents";
import latestMeetingBrief from "./tools/latest-meeting-brief";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "melano-command-center",
  title: "Melano Command Center",
  version: "0.1.0",
  instructions:
    "Herramientas del Autonomous Command Center de MELANO INC. Consultá prioridades del día, tareas, aprobaciones pendientes, estado de los agentes y el último brief ejecutivo; podés crear tareas operativas. Los datos son reales y están aislados por organización.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listTodayPriorities,
    listTasks,
    createTask,
    listPendingApprovals,
    listAgents,
    latestMeetingBrief,
  ],
});
