import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Loader2, ExternalLink, Power, Users, KeyRound, FileDown, Pencil } from "lucide-react";
import {
  listTenants,
  createTenantWithOperator,
  updateTenant,
  listTenantOperators,
  resetOperatorPassword,
  getTenantMonthlyReport,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatPriceBRL } from "@/lib/photo-utils";
import { downloadTenantMonthlyReport } from "@/lib/tenant-report-pdf";

export const Route = createFileRoute("/admin/empresas")({
  component: TenantsPage,
});

function formatCnpj(s: string) {
  const d = s.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}


function TenantsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTenants);
  const createFn = useServerFn(createTenantWithOperator);
  const updateFn = useServerFn(updateTenant);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => listFn(),
  });

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    operatorEmail: "",
    operatorPassword: "",
  });
  const [opsTenant, setOpsTenant] = useState<{ id: string; name: string } | null>(null);
  const [feeTenant, setFeeTenant] = useState<{ id: string; name: string; feePerPhoto: number } | null>(null);
  const [reportTenant, setReportTenant] = useState<{ id: string; name: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createFn({ data: form });
      toast.success(`Empresa ${form.name} criada`);
      setForm({ name: "", slug: "", operatorEmail: "", operatorPassword: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao criar empresa");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(id: string, name: string, current: string) {
    const next = current === "active" ? "suspended" : "active";
    try {
      await updateFn({ data: { id, name, status: next } });
      toast.success(`Empresa ${next === "active" ? "ativada" : "suspensa"}`);
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as empresas clientes do ParkSnap.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nova empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova empresa cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome da empresa</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: f.slug || slugify(name),
                    }));
                  }}
                  placeholder="Parque das Águas"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug (URL: /e/&lt;slug&gt;)</Label>
                <Input
                  required
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: slugify(e.target.value) }))
                  }
                  placeholder="parque-das-aguas"
                />
              </div>
              <div className="my-2 border-t border-border" />
              <p className="text-xs text-muted-foreground">
                Operador principal — terá acesso completo desta empresa.
              </p>
              <div className="space-y-1.5">
                <Label>E-mail do operador</Label>
                <Input
                  required
                  type="email"
                  value={form.operatorEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, operatorEmail: e.target.value }))
                  }
                  placeholder="admin@empresa.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Senha inicial</Label>
                <Input
                  required
                  minLength={6}
                  type="text"
                  value={form.operatorPassword}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, operatorPassword: e.target.value }))
                  }
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar empresa + operador
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma empresa cadastrada ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Empresa</th>
                <th className="px-4 py-2 text-left">Slug</th>
                <th className="px-4 py-2 text-right">Operadores</th>
                <th className="px-4 py-2 text-right">Fotos</th>
                <th className="px-4 py-2 text-right">Taxa/foto</th>
                <th className="px-4 py-2 text-right">Receita do mês</th>
                <th className="px-4 py-2 text-right">Comissão do mês</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{t.slug}</code>
                  </td>
                  <td className="px-4 py-3 text-right">{t.operatorCount}</td>
                  <td className="px-4 py-3 text-right">{t.photoCount}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setFeeTenant({ id: t.id, name: t.name, feePerPhoto: t.feePerPhoto })}
                      className="inline-flex items-center gap-1 rounded hover:bg-muted px-1.5 py-0.5"
                      title="Editar taxa"
                    >
                      {formatPriceBRL(t.feePerPhoto)}
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatPriceBRL(t.monthlyRevenue)}
                    <div className="text-xs font-normal text-muted-foreground">
                      {t.monthlyPhotos} foto{t.monthlyPhotos === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-primary">
                    {formatPriceBRL(t.monthlyCommission)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        t.status === "active"
                          ? "rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700"
                          : "rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700"
                      }
                    >
                      {t.status === "active" ? "ativa" : "suspensa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Baixar relatório mensal (PDF)"
                        onClick={() => setReportTenant({ id: t.id, name: t.name })}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Ver operadores"
                        onClick={() => setOpsTenant({ id: t.id, name: t.name })}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button asChild variant="ghost" size="sm" title="Abrir landing">
                        <a href={`/e/${t.slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={t.status === "active" ? "Suspender" : "Ativar"}
                        onClick={() => toggleStatus(t.id, t.name, t.status)}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <OperatorsDialog
        tenant={opsTenant}
        onClose={() => setOpsTenant(null)}
      />
      <FeeDialog
        tenant={feeTenant}
        onClose={() => setFeeTenant(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["admin-tenants"] })}
      />
      <ReportDialog
        tenant={reportTenant}
        onClose={() => setReportTenant(null)}
      />
    </div>
  );
}

function FeeDialog({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: { id: string; name: string; feePerPhoto: number } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(updateTenant);
  const [value, setValue] = useState("0");
  const [saving, setSaving] = useState(false);

  // Sync when tenant changes
  useEffect(() => {
    if (tenant) setValue(String(tenant.feePerPhoto ?? 0));
  }, [tenant?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    const fee = Number(value.replace(",", "."));
    if (!Number.isFinite(fee) || fee < 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    try {
      await updateFn({ data: { id: tenant.id, feePerPhoto: fee } });
      toast.success("Taxa atualizada");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao atualizar taxa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!tenant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Taxa por foto — {tenant?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Valor cobrado por foto (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.99"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Ex.: 0.99 = 99 centavos por foto carregada. A comissão mensal será
              calculada como taxa × número de fotos do período.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function ReportDialog({
  tenant,
  onClose,
}: {
  tenant: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const reportFn = useServerFn(getTenantMonthlyReport);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (!tenant) return;
    setLoading(true);
    try {
      const report = await reportFn({ data: { tenantId: tenant.id, year, month } });
      downloadTenantMonthlyReport(report);
      toast.success("Relatório gerado");
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao gerar relatório");
    } finally {
      setLoading(false);
    }
  }

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  return (
    <Dialog open={!!tenant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Relatório mensal — {tenant?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Gera um PDF detalhado com fotos, vendas, receita e comissão do período.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleDownload} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Baixar PDF
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OperatorsDialog({
  tenant,
  onClose,
}: {
  tenant: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const listFn = useServerFn(listTenantOperators);
  const resetFn = useServerFn(resetOperatorPassword);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tenant-operators", tenant?.id],
    queryFn: () => listFn({ data: { tenantId: tenant!.id } }),
    enabled: !!tenant,
  });

  const [resetting, setResetting] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [target, setTarget] = useState<{ id: string; email: string | null } | null>(null);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setResetting(target.id);
    try {
      await resetFn({ data: { operatorId: target.id, newPassword: pwd } });
      toast.success(`Senha de ${target.email ?? "operador"} redefinida`);
      setTarget(null);
      setPwd("");
      refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao redefinir senha");
    } finally {
      setResetting(null);
    }
  }

  return (
    <Dialog
      open={!!tenant}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setTarget(null);
          setPwd("");
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Operadores — {tenant?.name}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum operador cadastrado nesta empresa.
          </p>
        ) : target ? (
          <form onSubmit={handleReset} className="space-y-3">
            <p className="text-sm">
              Definir nova senha para{" "}
              <span className="font-medium">{target.email ?? target.id}</span>
            </p>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                required
                minLength={6}
                type="text"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setTarget(null);
                  setPwd("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={resetting === target.id}>
                {resetting === target.id && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Salvar nova senha
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {o.email ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Criado em{" "}
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                    {o.lastSignInAt && (
                      <>
                        {" · "}último login{" "}
                        {new Date(o.lastSignInAt).toLocaleDateString("pt-BR")}
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTarget({ id: o.id, email: o.email })}
                >
                  <KeyRound className="h-4 w-4" />
                  Redefinir senha
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
