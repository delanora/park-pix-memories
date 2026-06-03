import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { birthdateToPassword, normalizePhone } from "@/lib/photo-utils";
import { useServerFn } from "@tanstack/react-start";
import { findCustomerLoginEmail } from "@/lib/photos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "lucide-react";

export const Route = createFileRoute("/login-cliente")({
  head: () => ({ meta: [{ title: "Entrar — Cliente | ParkSnap" }] }),
  component: ClientLogin,
});

function ClientLogin() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [loading, setLoading] = useState(false);
  const lookupEmail = useServerFn(findCustomerLoginEmail);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const clean = normalizePhone(phone);
      if (clean.length < 8) throw new Error("Telefone inválido");
      const { email } = await lookupEmail({ data: { phone: clean } });
      if (!email) throw new Error("Telefone não encontrado. Verifique com o operador.");
      const password = birthdateToPassword(birthdate);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refresh();
      toast.success("Bem-vindo!");
      navigate({ to: "/cliente" });
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
            <User className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Acesso do cliente</h1>
            <p className="text-sm text-muted-foreground">
              Use o telefone informado na compra.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth">Data de nascimento</Label>
            <Input
              id="birth"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Sua senha é sua data de nascimento (DDMMAAAA).
            </p>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-sunset shadow-glow"
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
