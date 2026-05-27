import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login-operador")({
  head: () => ({ meta: [{ title: "Entrar — Operador | ParkSnap" }] }),
  component: OperatorLogin,
});

function OperatorLogin() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refresh();
      // Decide destination based on role
      const { supabase: sb } = await import("@/integrations/supabase/client");
      const { data: { session } } = await sb.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const { data: admin } = await sb
          .from("super_admins")
          .select("user_id")
          .eq("user_id", uid)
          .maybeSingle();
        toast.success("Bem-vindo!");
        navigate({ to: admin ? "/admin" : "/operador" });
        return;
      }
      toast.success("Bem-vindo!");
      navigate({ to: "/operador" });
    } catch (err: any) {
      toast.error(err.message ?? "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-sunset shadow-glow">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Acesso do operador</h1>
            <p className="text-sm text-muted-foreground">
              Painel administrativo do ParkSnap.
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-sunset shadow-glow"
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Novas contas de operador são criadas apenas por um operador já cadastrado.
          </p>
        </form>
      </div>
    </div>
  );
}
