import { formatCurrency } from "@/utils/formatCurrency";

interface StoreReportMetrics {
  totalProducts: number;
  totalStock: number;
  inventoryValue: number;
  offerCount: number;
  lowStock: number;
}

interface CategorySummaryEntry {
  name: string;
  productCount: number;
  stock: number;
  value: number;
  offerCount: number;
}

interface ProductSummaryEntry {
  name: string;
  categoryName: string;
  stock: number;
  price: number;
  offerPrice?: number;
}

interface CrossStoreSummaryEntry {
  storeName: string;
  overlapCount: number;
  totalStock: number;
  bestPrice: number | null;
  offerMatches: number;
}

interface StoreReportPayload {
  storeName: string;
  storeLocation: string;
  storeDescription?: string;
  generatedAt: Date;
  metrics: StoreReportMetrics;
  categorySummaries: CategorySummaryEntry[];
  lowStockProducts: ProductSummaryEntry[];
  offerProducts: ProductSummaryEntry[];
  crossStoreSummary: CrossStoreSummaryEntry[];
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toAsciiCurrency = (value: number) =>
  formatCurrency(value)
    .replace(/\u20a1/g, "CRC")
    .replace(/\u00a0/g, " ");

const renderTable = (rows: string, colspan: number) => {
  if (rows.trim().length > 0) {
    return rows;
  }
  return `<tr><td class="empty" colspan="${colspan}">Sin informacion disponible</td></tr>`;
};

export const buildStoreInventoryReportHtml = (
  payload: StoreReportPayload
): string => {
  const generatedAt = `${payload.generatedAt
    .toISOString()
    .replace("T", " ")
    .replace("Z", " UTC")}`;

  const metricsCards = `
    <div class="metrics">
      <div class="card">
        <div class="card-label">Productos</div>
        <div class="card-value">${payload.metrics.totalProducts}</div>
      </div>
      <div class="card">
        <div class="card-label">Stock total</div>
        <div class="card-value">${payload.metrics.totalStock}</div>
      </div>
      <div class="card">
        <div class="card-label">Valor inventario</div>
        <div class="card-value">${toAsciiCurrency(
          payload.metrics.inventoryValue
        )}</div>
      </div>
      <div class="card">
        <div class="card-label">Ofertas activas</div>
        <div class="card-value">${payload.metrics.offerCount}</div>
      </div>
      <div class="card">
        <div class="card-label">Bajo stock</div>
        <div class="card-value">${payload.metrics.lowStock}</div>
      </div>
    </div>
  `;

  const categoryRows = payload.categorySummaries
    .map(
      (entry) => `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td>${entry.productCount}</td>
        <td>${entry.stock}</td>
        <td>${entry.offerCount}</td>
        <td>${toAsciiCurrency(entry.value)}</td>
      </tr>
    `
    )
    .join("\n");

  const lowStockRows = payload.lowStockProducts
    .map(
      (entry) => `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(entry.categoryName)}</td>
        <td>${entry.stock}</td>
        <td>${toAsciiCurrency(entry.price)}</td>
      </tr>
    `
    )
    .join("\n");

  const offerRows = payload.offerProducts
    .map(
      (entry) => `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(entry.categoryName)}</td>
        <td>${toAsciiCurrency(entry.price)}</td>
        <td>${
          entry.offerPrice !== undefined
            ? toAsciiCurrency(entry.offerPrice)
            : "-"
        }</td>
      </tr>
    `
    )
    .join("\n");

  const crossStoreRows = payload.crossStoreSummary
    .map(
      (entry) => `
      <tr>
        <td>${escapeHtml(entry.storeName)}</td>
        <td>${entry.overlapCount}</td>
        <td>${entry.totalStock}</td>
        <td>${
          entry.bestPrice !== null ? toAsciiCurrency(entry.bestPrice) : "-"
        }</td>
        <td>${entry.offerMatches}</td>
      </tr>
    `
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Reporte inventario - ${escapeHtml(payload.storeName)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1e2438; }
    h1 { font-size: 26px; margin-bottom: 6px; }
    h2 { font-size: 18px; margin: 24px 0 12px; }
    p { margin: 6px 0; }
    .subtitle { color: #5b6580; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 24px 0; }
    .card { border: 1px solid #d0d4e4; border-radius: 12px; padding: 12px 14px; background: #f6f7fb; }
    .card-label { font-size: 12px; text-transform: uppercase; color: #5b6580; margin-bottom: 6px; }
    .card-value { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #d0d4e4; padding: 8px 10px; font-size: 13px; text-align: left; }
    th { background: #eef1fb; text-transform: uppercase; letter-spacing: 0.5px; }
    .empty { text-align: center; color: #8088a6; font-style: italic; }
  </style>
</head>
<body>
  <h1>${escapeHtml(payload.storeName)}</h1>
  <p class="subtitle">${escapeHtml(
    payload.storeLocation
  )} - Reporte generado el ${generatedAt}</p>
  ${
    payload.storeDescription
      ? `<p>${escapeHtml(payload.storeDescription)}</p>`
      : ""
  }
  ${metricsCards}

  <h2>Resumen por categoria</h2>
  <table>
    <thead>
      <tr>
        <th>Categoria</th>
        <th>Productos</th>
        <th>Stock</th>
        <th>Ofertas</th>
        <th>Valor</th>
      </tr>
    </thead>
    <tbody>
      ${renderTable(categoryRows, 5)}
    </tbody>
  </table>

  <h2>Productos con bajo stock</h2>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th>Categoria</th>
        <th>Stock</th>
        <th>Precio</th>
      </tr>
    </thead>
    <tbody>
      ${renderTable(lowStockRows, 4)}
    </tbody>
  </table>

  <h2>Ofertas activas</h2>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th>Categoria</th>
        <th>Precio base</th>
        <th>Precio oferta</th>
      </tr>
    </thead>
    <tbody>
      ${renderTable(offerRows, 4)}
    </tbody>
  </table>

  <h2>Coincidencias con otras tiendas</h2>
  <table>
    <thead>
      <tr>
        <th>Tienda</th>
        <th>Coincidencias</th>
        <th>Stock combinado</th>
        <th>Mejor precio</th>
        <th>Ofertas</th>
      </tr>
    </thead>
    <tbody>
      ${renderTable(crossStoreRows, 5)}
    </tbody>
  </table>
</body>
</html>`;
};
