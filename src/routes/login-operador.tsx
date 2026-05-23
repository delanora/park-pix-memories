import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { claimFirstOperator } from "@/lib/photos.functions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login-operador")({
  head: () => ({ meta: [{ title: "Entrar — Operador | ParkSnap" }] }),
  component: OperatorLogin,
});

function OperatorLogin() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const claimFn = useServerFn(claimFirstOperator);
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
      toast.success("Bem-vindo!");
      navigate({ to: "/operador" });
    } catch (err: any) {
      toast.error(err.message ?? "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      // If session created immediately (auto-confirm off → may be null)
      if (data.user) {
        try {
          await claimFn({ data: { userId: data.user.id } });
        } catch (err: any) {
          // ignore if not first operator; they need to be promoted manually
          if (!String(err.message).includes("Já existe")) throw err;
        }
      }
      toast.success(
        "Conta criada. Se for o primeiro operador, você terá acesso ao logar.",
      );
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginErr) throw loginErr;
      await refresh();
      navigate({ to: "/operador" });
    } catch (err: any) {
      toast.error(err.message ?? "Falha no cadastro");
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

        <Tabs defaultValue="login">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="E-mail" value={email} setValue={setEmail} type="email" />
              <Field
                label="Senha"
                value={password}
                setValue={setPassword}
                type="password"
              />
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-sunset shadow-glow"
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <Field label="E-mail" value={email} setValue={setEmail} type="email" />
              <Field
                label="Senha"
                value={password}
                setValue={setPassword}
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                O primeiro operador cadastrado recebe acesso automaticamente.
                Os demais precisam ser autorizados.
              </p>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-sunset shadow-glow"
              >
                {loading ? "Criando..." : "Criar conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  setValue,
  type = "text",
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
      />
    </div>
  );
}
