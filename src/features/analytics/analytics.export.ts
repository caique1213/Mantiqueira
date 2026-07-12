import type { AnalyticsData, AnalyticsFilters } from './analytics.types';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function downloadAnalyticsCsv(data: AnalyticsData, filters: AnalyticsFilters) {
  const rows: (string | number)[][] = [
    ['MANTIQUEIRA MAINTENANCE HUB — RELATÓRIO DE ANÁLISES'],
    ['Gerado em', dateFormatter.format(new Date(data.generatedAt))],
    ['Período das OS', data.reportWindowLabel],
    ['Setor', filters.sectorCode || 'Todos'],
    ['Postura', filters.postureNumber ?? 'Todas'],
    [],
    ['INDICADORES DE MANUTENÇÃO'],
    ['OS abertas no período', data.maintenance.workOrders],
    ['OS atualmente em aberto', data.maintenance.openWorkOrders],
    ['OS críticas em aberto', data.maintenance.criticalOpenWorkOrders],
    ['OS com SLA vencido', data.maintenance.overdueWorkOrders],
    ['OS resolvidas', data.maintenance.resolvedWorkOrders],
    ['OS aguardando peça', data.maintenance.waitingPartWorkOrders],
    ['Substituições de ativos', data.maintenance.replacements],
    [],
    ['INVENTÁRIO ATUAL'],
    ['Ativos físicos', data.inventory.assets],
    ['Ativos instalados', data.inventory.installedAssets],
    ['Ativos fora de posição', data.inventory.uninstalledAssets],
    ['Cadastros incompletos', data.inventory.incompleteAssets],
    ['Sem foto de placa', data.inventory.missingNameplate],
    ['Completude média', `${data.inventory.averageCompleteness}%`],
    [],
    ['OS POR STATUS', 'Quantidade'],
    ...data.workOrdersByStatus.map((item) => [item.label, item.value]),
    [],
    ['OS POR PRIORIDADE', 'Quantidade'],
    ...data.workOrdersByPriority.map((item) => [item.label, item.value]),
    [],
    ['ATIVOS POR TIPO', 'Quantidade'],
    ...data.inventoryByType.map((item) => [item.label, item.value]),
    [],
    ['COMPARAÇÃO DE MARCAS', 'Ativos instalados', 'OS no período', 'Falhas por ativo'],
    ...data.manufacturerRows.map((item) => [
      item.label,
      item.installedAssets,
      item.workOrders,
      item.failuresPerAsset.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
    ]),
    [],
    [
      'POSTURAS — CENÁRIO ATUAL',
      'OS abertas',
      'Críticas',
      'Falhas (30d)',
      'Reincidentes',
      'Completude',
    ],
    ...data.postureRows.map((item) => [
      item.label,
      item.openWorkOrders,
      item.criticalWorkOrders,
      item.failures,
      item.recurrentAssets,
      `${item.inventoryCompleteness}%`,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `mantiqueira-analises-${fileDate()}.csv`);
}

export async function downloadAnalyticsPdf(data: AnalyticsData, filters: AnalyticsFilters) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  document.setProperties({ title: 'Mantiqueira Maintenance Hub — Análises' });
  document.setFont('helvetica', 'bold');
  document.setFontSize(17);
  document.text('Mantiqueira Maintenance Hub', 14, 15);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.setTextColor(90);
  document.text(
    `Relatório técnico · ${data.reportWindowLabel} · Setor: ${filters.sectorCode || 'Todos'} · Postura: ${filters.postureNumber ?? 'Todas'}`,
    14,
    21,
  );
  document.text(`Gerado em ${dateFormatter.format(new Date(data.generatedAt))}`, 14, 26);

  autoTable(document, {
    startY: 31,
    theme: 'plain',
    head: [['Manutenção', 'Valor', 'Inventário atual', 'Valor']],
    body: [
      [
        'OS no período',
        numberFormatter.format(data.maintenance.workOrders),
        'Ativos físicos',
        numberFormatter.format(data.inventory.assets),
      ],
      [
        'Abertas agora',
        numberFormatter.format(data.maintenance.openWorkOrders),
        'Instalados',
        numberFormatter.format(data.inventory.installedAssets),
      ],
      [
        'Críticas abertas',
        numberFormatter.format(data.maintenance.criticalOpenWorkOrders),
        'Cadastros incompletos',
        numberFormatter.format(data.inventory.incompleteAssets),
      ],
      [
        'SLA vencido',
        numberFormatter.format(data.maintenance.overdueWorkOrders),
        'Sem foto de placa',
        numberFormatter.format(data.inventory.missingNameplate),
      ],
      [
        'Substituições',
        numberFormatter.format(data.maintenance.replacements),
        'Completude média',
        `${data.inventory.averageCompleteness}%`,
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2.4 },
    headStyles: { fillColor: [33, 37, 43], textColor: [255, 214, 71] },
  });

  const firstTableEnd =
    (document as typeof document & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    65;
  autoTable(document, {
    startY: firstTableEnd + 6,
    head: [['Marca', 'Ativos instalados', 'OS no período', 'Falhas por ativo']],
    body: data.manufacturerRows
      .slice(0, 12)
      .map((item) => [
        item.label,
        numberFormatter.format(item.installedAssets),
        numberFormatter.format(item.workOrders),
        item.failuresPerAsset.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
      ]),
    styles: { fontSize: 7.5, cellPadding: 2.1 },
    headStyles: { fillColor: [246, 185, 0], textColor: [25, 20, 4] },
    alternateRowStyles: { fillColor: [244, 245, 247] },
  });

  document.addPage('a4', 'landscape');
  document.setFont('helvetica', 'bold');
  document.setFontSize(13);
  document.setTextColor(30);
  document.text('Situação das posturas', 14, 15);
  autoTable(document, {
    startY: 20,
    head: [
      [
        'Postura',
        'OS abertas',
        'Críticas',
        `Falhas (${data.recurrence.windowDays}d)`,
        'Reincidentes',
        'Ativos',
        'Completude',
      ],
    ],
    body: data.postureRows.map((item) => [
      String(item.number).padStart(2, '0'),
      item.openWorkOrders,
      item.criticalWorkOrders,
      item.failures,
      item.recurrentAssets,
      item.installedAssets,
      `${item.inventoryCompleteness}%`,
    ]),
    styles: { fontSize: 7, cellPadding: 1.7 },
    headStyles: { fillColor: [33, 37, 43], textColor: [255, 214, 71] },
    alternateRowStyles: { fillColor: [244, 245, 247] },
  });
  document.save(`mantiqueira-analises-${fileDate()}.pdf`);
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function fileDate() {
  return new Date().toISOString().slice(0, 10);
}
