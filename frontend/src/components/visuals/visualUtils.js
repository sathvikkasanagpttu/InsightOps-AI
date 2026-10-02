export const PALETTES = {
  power_bi: ["#00b4d8", "#e6c348", "#2ec4b6", "#e76f51", "#7209b7", "#4361ee", "#4cc9f0", "#f72585"],
  emerald: ["#10b981", "#34d399", "#059669", "#6ee7b7", "#047857", "#14b8a6", "#2dd4bf"],
  neon: ["#00f0ff", "#ff007f", "#7928ca", "#00dfd8", "#ff4b4b", "#f9cb28", "#8e44ad"],
  amber: ["#f59e0b", "#d97706", "#b45309", "#fbbf24", "#fcd34d", "#f97316", "#ea580c"],
  ocean: ["#0284c7", "#38bdf8", "#0369a1", "#0ea5e9", "#7dd3fc", "#0c4a6e"]
};

export const VISUAL_TYPES = [
  { id: "column", label: "Column Chart", category: "Comparison", icon: "BarChart3", desc: "Vertical bars for comparing categories" },
  { id: "bar", label: "Bar Chart", category: "Comparison", icon: "BarChart2", desc: "Horizontal bars for ranking categories" },
  { id: "stacked_bar", label: "Stacked Bar", category: "Part-to-Whole", icon: "Layers", desc: "Compare proportions across dimensions" },
  { id: "line", label: "Line Chart", category: "Trend", icon: "LineChart", desc: "Visualize continuous trends over time" },
  { id: "area", label: "Area Chart", category: "Trend", icon: "Activity", desc: "Filled area emphasizing volume over time" },
  { id: "combo", label: "Combo Chart", category: "Correlation", icon: "TrendingUp", desc: "Dual-axis bar and line metrics" },
  { id: "pie", label: "Pie Chart", category: "Part-to-Whole", icon: "PieChart", desc: "Proportions of a whole category" },
  { id: "donut", label: "Donut Chart", category: "Part-to-Whole", icon: "PieChart", desc: "Ring chart with central KPI metric" },
  { id: "treemap", label: "Treemap", category: "Hierarchy", icon: "Grid", desc: "Nested proportional rectangular tiles" },
  { id: "scatter", label: "Scatter Plot", category: "Correlation", icon: "Compass", desc: "Relationship between two numeric measures" },
  { id: "bubble", label: "Bubble Chart", category: "Correlation", icon: "Compass", desc: "Three-measure visual with sized bubbles" },
  { id: "histogram", label: "Histogram", category: "Distribution", icon: "BarChart3", desc: "Frequency distribution of a numeric measure" },
  { id: "box_plot", label: "Box Plot", category: "Distribution", icon: "Sliders", desc: "Quartiles, median, and outlier detection" },
  { id: "heatmap", label: "Heatmap Matrix", category: "Matrix", icon: "Grid", desc: "2D density grid across two dimensions" },
  { id: "funnel", label: "Funnel Chart", category: "Pipeline", icon: "Filter", desc: "Sequential stage drop-off and conversion" },
  { id: "gauge", label: "Gauge Meter", category: "KPI", icon: "Activity", desc: "Speedometer progress toward target" },
  { id: "kpi_card", label: "KPI Card", category: "KPI", icon: "Sparkles", desc: "Hero metric with target, variance & sparkline" },
  { id: "table", label: "Data Matrix Table", category: "Detail", icon: "Table", desc: "Tabular summary with in-cell data bars" }
];

export function formatNumber(num, compact = true, prefix = "") {
  if (num === null || num === undefined || isNaN(num)) return "–";
  const abs = Math.abs(num);
  if (compact) {
    if (abs >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${prefix}${(num / 1e3).toFixed(1)}k`;
  }
  return `${prefix}${Number(num).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatPercentage(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return "0.0%";
  return `${pct >= 0 ? "+" : ""}${Number(pct).toFixed(1)}%`;
}

export function suggestVisualType({ xCol, yCols = [], legendCol, schema = [] }) {
  const xMeta = schema.find(c => c.name === xCol);
  const isDate = xMeta && (xMeta.semantic_type === "datetime" || xMeta.inferred_type === "datetime");
  const yCount = Array.isArray(yCols) ? yCols.length : (yCols ? 1 : 0);

  if (yCount === 0 && !xCol) return "kpi_card";
  if (yCount === 1 && !xCol) return "gauge";
  if (isDate && yCount >= 2) return "combo";
  if (isDate && yCount >= 1) return "area";
  if (xCol && legendCol && yCount >= 1) return "stacked_bar";
  if (xCol && yCount >= 2) return "combo";
  if (xMeta && xMeta.unique_count && xMeta.unique_count <= 5 && yCount <= 1) return "donut";
  if (xMeta && xMeta.unique_count && xMeta.unique_count > 10 && yCount === 1) return "treemap";
  if (!isDate && yCount === 1) return "column";
  if (yCount === 2 && !xCol) return "scatter";
  return "column";
}

export function exportDataToCsv(data, filename = "visualization_data.csv") {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(",")
  );
  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportElementToPng(elementId, filename = "visual_chart.png") {
  const el = document.getElementById(elementId);
  if (!el) return;

  const svg = el.querySelector("svg");
  if (!svg) {
    window.print();
    return;
  }

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const rect = svg.getBoundingClientRect();
  const scale = 2; // High-res 2x
  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;
  const ctx = canvas.getContext("2d");

  // Dark background for crisp contrast
  ctx.fillStyle = "#0c1524";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = filename;
    link.href = pngUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  img.src = url;
}
