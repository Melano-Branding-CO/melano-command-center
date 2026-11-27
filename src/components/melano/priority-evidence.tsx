import { Link } from "@tanstack/react-router";
import { useRowById } from "@/lib/melano-queries";

export function PriorityOwner({
  userId,
  agentName,
}: {
  userId: string | null;
  agentName: string | undefined;
}) {
  const { data: user } = useRowById<{ full_name: string | null }>("profiles", userId ?? undefined);
  return (
    <>
      {userId ? (user?.full_name ?? `Usuario ${userId.slice(0, 8)}`) : (agentName ?? "Sin asignar")}
    </>
  );
}

export function PriorityEvidence({ description }: { description: string | null }) {
  let source: { mode?: string; source_path?: string; source_id?: string };
  try {
    source = JSON.parse(description ?? "");
  } catch {
    return null;
  }
  if (!source || source.mode !== "rules" || !source.source_id) return null;
  const path = source.source_path;
  if (path !== "/leads" && path !== "/clientes" && path !== "/tasks") return null;
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Por reglas, sin IA ·{" "}
      <Link to={path} className="underline">
        Ver registro de origen
      </Link>{" "}
      · {source.source_id}
    </p>
  );
}
