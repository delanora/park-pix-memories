import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { MonthlyReportDTO } from "@/lib/admin.functions";
import { formatPriceBRL } from "@/lib/photo-utils";

export function downloadTenantMonthlyReport(report: MonthlyReportDTO) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório mensal — ParkSnap", margin, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(`Empresa: ${report.tenant.name}  ·  /e/${report.tenant.slug}`, margin, y);
  y += 14;
  const label = report.period.label.charAt(0).toUpperCase() + report.period.label.slice(1);
  doc.text(`Período: ${label}`, margin, y);
  y += 14;
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 22;
  doc.setTextColor(0);

  // Summary cards
  const summary = [
    ["Fotos no período", String(report.photosCount)],
    ["Vendas", String(report.salesCount)],
    ["Receita total (vendas)", formatPriceBRL(report.totalRevenue)],
    ["Taxa por foto", formatPriceBRL(report.tenant.feePerPhoto)],
    ["Comissão ParkSnap (taxa × fotos)", formatPriceBRL(report.commission)],
    ["Líquido estimado para a empresa", formatPriceBRL(report.netForClient)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: summary,
    theme: "striped",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 11, cellPadding: 6 },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // Commission breakdown explanation
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Como a comissão é calculada", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  const explain = `A ParkSnap cobra uma taxa fixa de ${formatPriceBRL(
    report.tenant.feePerPhoto,
  )} por foto carregada na plataforma. No período, foram registradas ${report.photosCount} foto(s), totalizando ${formatPriceBRL(
    report.commission,
  )} em comissão. O valor é independente das vendas realizadas para clientes finais.`;
  const lines = doc.splitTextToSize(explain, pageWidth - margin * 2);
  doc.text(lines, margin, y);
  y += lines.length * 12 + 18;
  doc.setTextColor(0);

  // Daily breakdown
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Detalhamento diário", margin, y);
  y += 6;

  const fee = report.tenant.feePerPhoto;
  const dailyRows = report.daily.map((d) => {
    const [yy, mm, dd] = d.date.split("-");
    return [
      `${dd}/${mm}/${yy}`,
      String(d.photos),
      formatPriceBRL(d.photos * fee),
      String(d.sales),
      formatPriceBRL(d.revenue),
    ];
  });

  autoTable(doc, {
    startY: y + 6,
    head: [["Dia", "Fotos", "Comissão", "Vendas", "Receita"]],
    body: dailyRows,
    foot: [[
      "Total",
      String(report.photosCount),
      formatPriceBRL(report.commission),
      String(report.salesCount),
      formatPriceBRL(report.totalRevenue),
    ]],
    theme: "grid",
    headStyles: { fillColor: [40, 40, 40] },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}  ·  ParkSnap`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" },
    );
  }

  const filename = `relatorio_${report.tenant.slug}_${report.period.year}-${String(
    report.period.month,
  ).padStart(2, "0")}.pdf`;
  doc.save(filename);
}
