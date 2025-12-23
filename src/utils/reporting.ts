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

// ======== SIMPLE LISTING REPORTS (Solicitado por usuario) ========

export interface SimpleProductLine {
  name: string;
  stock: number;
  categoryName?: string;
  price?: number;
  offerPrice?: number;
  onlinePrice?: number;
  upc?: string | null;
  box?: string | null;
}

const sectionizeByCategory = (
  items: SimpleProductLine[],
  groupByCategory: boolean
) => {
  if (!groupByCategory) {
    return [
      {
        title: "Inventario",
        available: items.filter((i) => i.stock > 0),
        out: items.filter((i) => i.stock <= 0),
      },
    ];
  }

  const map = new Map<string, SimpleProductLine[]>();
  items.forEach((it) => {
    const key = it.categoryName?.trim() || "Sin categoría";
    const arr = map.get(key) ?? [];
    arr.push(it);
    map.set(key, arr);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, arr]) => ({
      title: category,
      available: arr
        .filter((i) => i.stock > 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
      out: arr
        .filter((i) => i.stock <= 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
};

const escape = (s: string) => escapeHtml(s ?? "");

// Offline Code39 SVG renderer (subset)
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn", // start/stop
};

const renderBarcode39 = (code?: string | null) => {
  if (!code) return "";
  const trimmed = code.trim();
  if (!trimmed) return "";
  const printable = `*${trimmed
    .replace(/[^0-9A-Z\-\. \$\/\+%]/g, "")
    .toUpperCase()}*`;
  const narrow = 2;
  const wide = 5;
  const height = 44;
  const gap = 1;
  let x = 0;
  const rects: string[] = [];
  const units = printable.split("").flatMap((ch) => {
    const pattern = CODE39[ch];
    if (!pattern) return [];
    return pattern.split("");
  });
  units.forEach((u, idx) => {
    const w = u === "w" ? wide : narrow;
    if (idx % 2 === 0) {
      rects.push(
        `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#111"/>`
      );
    }
    x += w + gap;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}" role="img" aria-label="${escapeHtml(
    trimmed
  )}">${rects.join("")}</svg>`;
  return `
    <div class="code-item">
      <div class="barcode-svg">${svg}</div>
      <div class="code-label">${escapeHtml(trimmed)}</div>
    </div>
  `;
};

export const buildStoreListingReportHtml = (payload: {
  title: string;
  subtitle?: string;
  generatedAt: Date;
  products: SimpleProductLine[];
  groupByCategory?: boolean;
  comment?: string;
  arrivalNoteOut?: string;
}): string => {
  const generatedAt = `${payload.generatedAt
    .toISOString()
    .replace("T", " ")
    .replace("Z", " UTC")}`;

  const sections = sectionizeByCategory(
    payload.products,
    payload.groupByCategory ?? true
  );

  const availableSectionsHtml = sections
    .map((section) => {
      if (section.available.length === 0) return "";

      const rows = section.available
        .map(
          (p) => `
        <tr>
          <td class="item-name">${escape(p.name)}</td>
          <td class="item-qty">${p.stock}</td>
          <td class="item-price">${
            p.price ? toAsciiCurrency(p.price) : "-"
          }</td>
          <td class="item-price">${
            p.offerPrice ? toAsciiCurrency(p.offerPrice) : "-"
          }</td>
          <td class="item-price">${
            p.onlinePrice ? toAsciiCurrency(p.onlinePrice) : "-"
          }</td>
          <td class="item-codes">${p.upc ? escape(p.upc) : "-"}</td>
          <td class="item-codes">${p.box ? escape(p.box) : "-"}</td>
        </tr>
        ${
          p.upc || p.box
            ? `<tr class="barcode-row"><td colspan="7" class="barcode-cell">${[
                p.upc
                  ? `<div class="barcode-item"><span class="barcode-label">UPC:</span>${renderBarcode39(
                      p.upc
                    )}</div>`
                  : "",
                p.box
                  ? `<div class="barcode-item"><span class="barcode-label">Caja:</span>${renderBarcode39(
                      p.box
                    )}</div>`
                  : "",
              ]
                .filter(Boolean)
                .join("")}</td></tr>`
            : ""
        }
        `
        )
        .join("");

      return `
        <section class="category-section">
          <h2 class="category-title">${escape(section.title)}</h2>
          <table class="inventory-table">
            <thead>
              <tr>
                <th class="col-name">Nombre</th>
                <th class="col-qty">Cantidad</th>
                <th class="col-price">Precio Regular</th>
                <th class="col-price">Precio Oferta</th>
                <th class="col-price">Precio Online</th>
                <th class="col-code">Código UPC</th>
                <th class="col-code">Código Caja</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </section>
      `;
    })
    .filter(Boolean)
    .join("\n");

  const outOfStockRows = sections
    .flatMap((s) => s.out)
    .map(
      (p) => `
      <tr class="out-of-stock-row">
        <td class="item-name">${escape(p.name)}</td>
        <td class="item-qty">0</td>
        <td class="item-price">${p.price ? toAsciiCurrency(p.price) : "-"}</td>
        <td class="item-price">${
          p.offerPrice ? toAsciiCurrency(p.offerPrice) : "-"
        }</td>
        <td class="item-price">${
          p.onlinePrice ? toAsciiCurrency(p.onlinePrice) : "-"
        }</td>
        <td class="item-codes">${p.upc ? escape(p.upc) : "-"}</td>
        <td class="item-codes">${p.box ? escape(p.box) : "-"}</td>
      </tr>
      ${
        p.upc || p.box
          ? `<tr class="barcode-row"><td colspan="7" class="barcode-cell">${[
              p.upc
                ? `<div class="barcode-item"><span class="barcode-label">UPC:</span>${renderBarcode39(
                    p.upc
                  )}</div>`
                : "",
              p.box
                ? `<div class="barcode-item"><span class="barcode-label">Caja:</span>${renderBarcode39(
                    p.box
                  )}</div>`
                : "",
            ]
              .filter(Boolean)
              .join("")}</td></tr>`
          : ""
      }
      `
    )
    .join("");

  const outOfStockHtml =
    outOfStockRows.length > 0
      ? `
    <section class="out-of-stock-section">
      <h2 class="section-title">Productos Agotados</h2>
      ${
        payload.arrivalNoteOut
          ? `<p class="arrival-note">Nota: ${escape(
              payload.arrivalNoteOut
            )}</p>`
          : ""
      }
      <table class="inventory-table">
        <thead>
          <tr>
            <th class="col-name">Nombre</th>
            <th class="col-qty">Cantidad</th>
            <th class="col-price">Precio Regular</th>
            <th class="col-price">Precio Oferta</th>
            <th class="col-price">Precio Online</th>
            <th class="col-code">Código UPC</th>
            <th class="col-code">Código Caja</th>
          </tr>
        </thead>
        <tbody>
          ${outOfStockRows}
        </tbody>
      </table>
    </section>
  `
      : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escape(payload.title)}</title>
  <style>
    body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #1e2438; background: #fff; }
    h1 { font-size: 28px; font-weight: 700; margin: 0 0 4px; }
    .subtitle { color: #5b6580; margin-bottom: 20px; font-size: 14px; }
    p { font-size: 13px; margin: 12px 0; }
    .category-section { margin-bottom: 32px; page-break-inside: avoid; }
    .category-title { font-size: 16px; font-weight: 600; color: #2a3b5d; margin: 0 0 12px; border-bottom: 2px solid #e0e4f0; padding-bottom: 6px; }
    .section-title { font-size: 16px; font-weight: 600; color: #8b0000; margin: 20px 0 12px; border-bottom: 2px solid #ffcccc; padding-bottom: 6px; }
    .out-of-stock-section { margin-top: 40px; page-break-inside: avoid; }
    .arrival-note { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px 12px; font-size: 12px; color: #664d00; margin: 8px 0 12px; }
    .inventory-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .inventory-table thead th { background: #f5f7fc; color: #2a3b5d; font-weight: 600; font-size: 12px; padding: 10px 8px; text-align: left; border-bottom: 2px solid #d0d4e4; }
    .inventory-table tbody tr { border-bottom: 1px solid #e8ecf5; }
    .inventory-table tbody tr:hover { background: #f9fafd; }
    .inventory-table td { padding: 8px 8px; font-size: 12px; }
    .col-name { width: 35%; }
    .col-qty { width: 8%; text-align: center; }
    .col-price { width: 10%; text-align: right; }
    .col-code { width: 10%; text-align: center; font-family: monospace; }
    .item-name { font-weight: 500; color: #1e2438; }
    .item-qty { text-align: center; }
    .item-price { text-align: right; color: #2f3b66; }
    .item-codes { text-align: center; font-family: monospace; color: #5b6580; }
    .out-of-stock-row { opacity: 0.7; }
    .barcode-row { }
    .barcode-cell { background: #f9fafd; padding: 24px 16px !important; }
    .barcode-item { display: inline-block; margin-right: 60px; margin-bottom: 20px; vertical-align: top; }
    .barcode-label { font-size: 11px; font-weight: 600; color: #5b6580; text-transform: uppercase; display: block; margin-bottom: 8px; }
    .barcode-svg { display: block; margin-bottom: 8px; }
    .code-label { font-size: 12px; color: #1e2438; text-align: center; margin-top: 4px; letter-spacing: 1px; font-weight: 500; }
  </style>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="format-detection" content="telephone=no" />
  <meta name="robots" content="noindex" />
</head>
<body>
  <h1>${escape(payload.title)}</h1>
  ${
    payload.subtitle
      ? `<div class="subtitle">${escape(
          payload.subtitle
        )} — Generado el ${generatedAt}</div>`
      : `<div class="subtitle">Generado el ${generatedAt}</div>`
  }
  ${payload.comment ? `<p>${escape(payload.comment)}</p>` : ""}
  
  ${availableSectionsHtml}
  
  ${outOfStockHtml}
</body>
</html>`;
};

export const buildGlobalListingReportHtml = (payload: {
  generatedAt: Date;
  stores: {
    storeName: string;
    storeLocation?: string;
    products: SimpleProductLine[];
  }[];
}): string => {
  const generatedAt = `${payload.generatedAt
    .toISOString()
    .replace("T", " ")
    .replace("Z", " UTC")}`;

  const storesHtml = payload.stores
    .sort((a, b) => a.storeName.localeCompare(b.storeName))
    .map((entry) =>
      buildStoreListingReportHtml({
        title: `Inventario de ${entry.storeName}`,
        subtitle: entry.storeLocation ?? undefined,
        generatedAt: payload.generatedAt,
        products: entry.products,
        groupByCategory: true,
      })
        .replace(/^<!DOCTYPE[\s\S]*?<body>/, "")
        .replace(/<\/body>[\s\S]*$/m, "")
    )
    .join(
      '\n<hr style="margin:24px 0;border:none;border-top:1px solid #d0d4e4"/>\n'
    );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Inventario general</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1e2438; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    .subtitle { color: #5b6580; margin-bottom: 18px; }
  </style>
</head>
<body>
  <h1>Inventario general</h1>
  <div class="subtitle">Generado el ${generatedAt}</div>
  ${storesHtml}
</body>
</html>`;
};

// ======== TEXT REPORTS (copy-friendly) ========

const padDots = (label: string, qtyLabel: string, width = 40) => {
  const base = `${label} `;
  const dots = Math.max(2, width - base.length - qtyLabel.length);
  return `${base}${".".repeat(dots)} ${qtyLabel}`;
};

const formatPricesLine = (p: SimpleProductLine): string | null => {
  const parts: string[] = [];
  if (typeof p.price === "number")
    parts.push(`Regular: ${toAsciiCurrency(p.price)}`);
  if (typeof p.offerPrice === "number")
    parts.push(`Oferta: ${toAsciiCurrency(p.offerPrice)}`);
  if (typeof p.onlinePrice === "number")
    parts.push(`Online: ${toAsciiCurrency(p.onlinePrice)}`);
  return parts.length ? parts.join("  ") : null;
};

export const buildStoreListingReportText = (payload: {
  title: string;
  subtitle?: string;
  generatedAt?: Date;
  products: SimpleProductLine[];
  groupByCategory?: boolean;
  comment?: string;
  arrivalNoteOut?: string;
}): string => {
  const header: string[] = [];
  header.push(
    payload.subtitle ? `${payload.title} - ${payload.subtitle}` : payload.title
  );
  if (payload.generatedAt) {
    header.push(`Generado el ${payload.generatedAt.toLocaleString()}`);
  }
  if (payload.comment) header.push(payload.comment);

  const sections = sectionizeByCategory(
    payload.products,
    payload.groupByCategory ?? true
  );
  const lines: string[] = [...header, ""];
  sections.forEach((section) => {
    lines.push(section.title);
    if (section.available.length) {
      lines.push("", "Disponibles:");
      section.available.forEach((p) => {
        lines.push(
          `* ${padDots(p.name, `(${p.stock} ${p.stock === 1 ? "ud" : "uds"})`)}`
        );
        const pricesLine = formatPricesLine(p);
        if (pricesLine) lines.push(pricesLine);
        if (p.upc) lines.push(`UPC: ${p.upc}`);
        if (p.box) lines.push(`Caja: ${p.box}`);
        lines.push("");
      });
    } else {
      lines.push("", "Disponibles:", "(Sin productos)", "");
    }

    if (section.out.length) {
      lines.push("Agotados:");
      section.out.forEach((p) => {
        lines.push(`* ${padDots(p.name, "(0 uds)")}`);
        if (payload.arrivalNoteOut) lines.push(payload.arrivalNoteOut);
        const pricesLine = formatPricesLine(p);
        if (pricesLine) lines.push(pricesLine);
        if (p.upc) lines.push(`UPC: ${p.upc}`);
        if (p.box) lines.push(`Caja: ${p.box}`);
        lines.push("");
      });
    }

    lines.push("----------------------------------------", "");
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
};

export const buildGlobalListingReportText = (payload: {
  generatedAt?: Date;
  stores: {
    storeName: string;
    storeLocation?: string;
    products: SimpleProductLine[];
  }[];
  comment?: string;
  arrivalNoteOut?: string;
}): string => {
  const lines: string[] = [];
  lines.push("Inventario general");
  if (payload.generatedAt)
    lines.push(`Generado el ${payload.generatedAt.toLocaleString()}`);
  if (payload.comment) lines.push(payload.comment);
  lines.push("");

  payload.stores
    .sort((a, b) => a.storeName.localeCompare(b.storeName))
    .forEach((entry, idx) => {
      lines.push(
        `Inventario de ${entry.storeName}${
          entry.storeLocation ? ` - ${entry.storeLocation}` : ""
        }`
      );
      lines.push("");
      lines.push(
        buildStoreListingReportText({
          title: entry.storeName,
          products: entry.products,
          groupByCategory: true,
          arrivalNoteOut: payload.arrivalNoteOut,
        })
      );
      if (idx < payload.stores.length - 1) {
        lines.push("\n========================================\n");
      }
    });

  return lines.join("\n");
};

export interface SalesReportSection {
  title: string;
  items: { name: string; quantity: number }[];
}

export const buildStoreSalesReportText = (payload: {
  storeName: string;
  storeLocation?: string | null;
  attended?: number;
  salesCount?: number;
  sections: SalesReportSection[];
  outOfStock?: string[];
  observations?: string;
}): string => {
  const lines: string[] = [];
  const location = payload.storeLocation?.trim();
  lines.push(`Tienda: ${payload.storeName}${location ? ` (${location})` : ""}`);
  lines.push("");
  lines.push(`Cantidad de Personas Atendidas ${payload.attended ?? 0}`);
  lines.push("");
  const totalSold = payload.sections
    .flatMap((s) => s.items)
    .reduce((acc, it) => acc + it.quantity, 0);
  lines.push(`Ventas realizadas: ${payload.salesCount ?? totalSold}`);
  lines.push("");

  const order = ["Consolas", "Juegos", "Accesorios", "Otros"];
  order.forEach((title) => {
    const section = payload.sections.find((s) => s.title === title);
    lines.push(`${title}:`);
    if (section && section.items.length) {
      section.items.forEach((item) => {
        lines.push(`- ${item.name} (x${item.quantity})`);
      });
    }
    lines.push("");
  });

  lines.push("*Observaciones *");
  if (payload.observations) {
    lines.push(payload.observations);
  }
  lines.push("");

  lines.push("Agotados:");
  if (payload.outOfStock?.length) {
    payload.outOfStock.forEach((name) => {
      lines.push(`- ${name}`);
    });
  } else {
    lines.push("- Ninguno");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
};
