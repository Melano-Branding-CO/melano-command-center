import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useOrg } from "@/lib/melano";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/debug-access")({
  component: DebugAccessPage,
});

function DebugAccessPage() {
  const { data: org } = useOrg();
  const [debug, setDebug] = useState<{
    userId?: string;
    orgId?: string;
    membershipExists?: boolean;
    role?: string;
    error?: string;
  }>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  const check = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !org?.id) return;

      // Check if user is in organization_members
      const { data: membership, error } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .maybeSingle();

      setDebug({
        userId: user.id,
        orgId: org.id,
        membershipExists: !!membership,
        role: membership?.role,
        error: error?.message,
      });
      setLastCheck(new Date().toLocaleTimeString());
    } catch (e) {
      setDebug(prev => ({ ...prev, error: String(e) }));
    }
  };

  useEffect(() => {
    check();
  }, [org]);

  const handleRefreshSession = async () => {
    setRefreshing(true);
    try {
      // Refresh the session to get a new JWT token with updated claims
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;

      // Re-check membership after refresh
      await new Promise(r => setTimeout(r, 500));
      await check();
    } catch (e) {
      setDebug(prev => ({ ...prev, error: `Refresh failed: ${String(e)}` }));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Debug Access</h1>

      <div className="mb-6 flex gap-2">
        <Button onClick={() => check()} variant="outline">
          Verificar Ahora
        </Button>
        <Button onClick={handleRefreshSession} disabled={refreshing}>
          {refreshing ? "Refrescando..." : "Refrescar Sesión JWT"}
        </Button>
      </div>

      {lastCheck && (
        <p className="text-xs text-muted-foreground mb-4">Última verificación: {lastCheck}</p>
      )}

      <div className="bg-slate-100 p-4 rounded text-sm overflow-auto mb-4 font-mono">
        {JSON.stringify(debug, null, 2)}
      </div>

      <div className="space-y-2">
        {debug.membershipExists ? (
          <div className="p-4 bg-green-100 rounded text-green-800 text-sm">
            <strong>✓ Acceso Verificado</strong><br/>
            Usuario está en organization_members con rol: <strong>{debug.role}</strong>
          </div>
        ) : (
          <div className="p-4 bg-red-100 rounded text-red-800 text-sm">
            <strong>✗ Acceso Denegado</strong><br/>
            Usuario NO está en organization_members. Contactá a un admin para que te agregue.
          </div>
        )}

        {debug.error && (
          <div className="p-4 bg-yellow-100 rounded text-yellow-800 text-sm">
            <strong>⚠ Error</strong><br/>
            {debug.error}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded text-sm text-blue-900">
        <h3 className="font-semibold mb-2">Qué hacer si ves "Acceso Denegado":</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Haz click en "Refrescar Sesión JWT" (arriba)</li>
          <li>Verifica nuevamente haciendo click en "Verificar Ahora"</li>
          <li>Si sigue denegado, contactá a un admin</li>
        </ol>
      </div>
    </div>
  );
}
