import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createOperator, listOperators } from "@/lib/photos.functions";
import { RequireRole } from "@/components/require-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/operador/usuarios")({
  head: () => ({ meta: [{ title: "Operadores | ParkSnap" }] }),
  component: () => (
    <RequireRole role="operator" fullOperator>
      <OperatorsPage />
    </RequireRole>
  ),
});

type OperatorKind = "full" | "photo";

function OperatorsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOperators);
  const createFn = useServerFn(createOperator);
  const { data, isLoading } = useQuery({
    queryKey: ["operators"],
    queryFn: () => listFn(),
  });
  const [form, setForm] = useState<{ email: string; password: string; kind: OperatorKind }>({
    email: "",
    password: "",
    kind: "full",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createFn({
        data: {
          email: form.email.trim(),
          password: form.password,
          restricted: form.kind === "photo",
        },
      });
      toast.success(
        `${form.kind === "photo" ? "Operador de fotos" : "Operador"} ${form.email} criado com sucesso`,
      );
      setForm({ email: "", password: "", kind: "full" });
      qc.invalidateQueries({ queryKey: ["operators"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao criar operador");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Operadores</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre novos operadores do sistema.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <UserPlus className="h-5 w-5 text-primary" />
            Novo operador
          </h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo de operador</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as OperatorKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Operador completo</SelectItem>
                  <SelectItem value="photo">Operador de fotos</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.kind === "photo"
                  ? "Acesso apenas à galeria e envio de fotos. Sem vendas, configurações nem criação de operadores."
                  : "Acesso total ao painel administrativo da empresa."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="operador@parque.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input
                type="text"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-sunset shadow-glow"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar operador
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">
            Operadores cadastrados
          </h2>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum operador.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{o.email ?? "—"}</span>
                    {o.restricted ? (
                      <Badge variant="secondary" className="shrink-0">Fotos</Badge>
                    ) : (
                      <Badge className="shrink-0">Completo</Badge>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
