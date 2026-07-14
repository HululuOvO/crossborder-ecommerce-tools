const productNameMap = {
  "毛巾架": "Towel rack",
  "浴室架": "Shower caddy",
  "砧板": "Cutting board",
  "收纳架": "Storage rack",
  "鞋架": "Shoe rack"
};

const modules = [
  {
    id: "amazon",
    tag: "FBA",
    title: "Amazon Listing Helper",
    desc: "Generate reviewable Seller Central fields with unit conversion and manual content checks.",
    detail: "This module helps operators prepare copy-ready listing fields, normalize dimensions and weight, and flag title, description, bullet point, color, and compliance-sensitive fields for review. The public version runs in the browser."
  },
  {
    id: "walmart",
    tag: "POD",
    title: "WFS Discrepancy Review",
    desc: "Match received units and generate clean review rows from shipment spreadsheets.",
    detail: "This module lets users paste or import CSV-style shipment data, match received units, and download a review CSV. The public version avoids account login and RPA."
  },
  {
    id: "goodcang",
    tag: "GC",
    title: "Warehouse Product Builder",
    desc: "Prepare warehouse bulk-upload fields from product source data and manual overrides.",
    detail: "This module maps product source fields into a warehouse upload preview and marks risky fields for manual review. The public version downloads CSV instead of using private templates."
  },
  {
    id: "sop",
    tag: "KB",
    title: "SOP Knowledge Base",
    desc: "Search public-safe SOP summaries and convert operating rules into checklists.",
    detail: "This module shows how SOP content can be turned into structured workflow guidance without exposing private screenshots or company documents."
  }
];

let latestCsv = "";
let latestAmazonText = "";

const walmartSampleMonthly = `Shipment ID,Received Units
7227377WFA,12
7189537WFA,8
7000001WFA,5`;

const walmartSampleCase = `Store,Shipment ID,Inbound Order ID,Declared Units
Hotor,7227377WFA,IO-1001,15
VacLife,7189537WFA,IO-1002,8
Powools,7000001WFA,IO-1003,3`;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function toCsv(headers, rows) {
  const encode = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.map(encode).join(","), ...rows.map((row) => row.map(encode).join(","))].join("\n");
}

function downloadText(filename, content) {
  if (!content) return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map((x) => x.trim());
  return lines.map((line) => {
    const values = line.split(",").map((x) => x.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function readTextFile(file, targetSelector) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.querySelector(targetSelector).value = String(reader.result || "");
  };
  reader.readAsText(file);
}

function renderModules(filter = "") {
  const grid = document.querySelector("#module-grid");
  const normalized = filter.trim().toLowerCase();
  const visible = modules.filter((item) => {
    return [item.title, item.desc, item.tag].join(" ").toLowerCase().includes(normalized);
  });
  grid.innerHTML = visible.map((item) => `
    <button class="module-card" data-module="${item.id}" type="button">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.desc)}</span>
      <em>${escapeHtml(item.tag)}</em>
    </button>
  `).join("");
  grid.querySelectorAll("[data-module]").forEach((button) => {
    button.addEventListener("click", () => showModule(button.dataset.module));
  });
}

function showModule(id) {
  const item = modules.find((module) => module.id === id) || modules[0];
  document.querySelector("#module-detail").innerHTML = `
    <h4>${escapeHtml(item.title)}</h4>
    <p>${escapeHtml(item.detail)}</p>
    <div class="review-note">Public demo note: private data, real store names, account flows, and internal SOP files are intentionally removed.</div>
  `;
  document.querySelectorAll(".module-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.module === id);
  });
}

function runGoodcang() {
  const sku = document.querySelector("#gc-sku").value.trim();
  const cnName = document.querySelector("#gc-cn").value.trim();
  const englishBase = productNameMap[cnName] || "Product";
  const rows = [
    ["商品编码", sku],
    ["中文申报品名", cnName],
    ["英文名称", `${englishBase} / ${sku}`],
    ["材质", document.querySelector("#gc-material").value.trim()],
    ["商品链接", document.querySelector("#gc-url").value.trim()],
    ["出口申报单价 USD", document.querySelector("#gc-export").value.trim()],
    ["进口申报单价 USD", document.querySelector("#gc-import").value.trim()]
  ];
  latestCsv = toCsv(["Field", "Value"], rows);
  document.querySelector("#goodcang-result").innerHTML = `
    <h4>Warehouse upload preview</h4>
    ${table(["Field", "Value"], rows)}
    <div class="review-note">Public tool note: download is CSV for easy review. Real platform templates should be checked before upload.</div>
  `;
}

function runWalmart() {
  const monthly = parseCsv(document.querySelector("#wm-monthly").value);
  const cases = parseCsv(document.querySelector("#wm-case").value);
  const receivedMap = new Map();
  for (const row of monthly) {
    const shipment = row["Shipment ID"];
    const received = Number(row["Received Units"] || 0);
    receivedMap.set(shipment, (receivedMap.get(shipment) || 0) + received);
  }
  const active = [];
  const removed = [];
  for (const row of cases) {
    const shipment = row["Shipment ID"];
    const declared = Number(row["Declared Units"] || 0);
    const received = receivedMap.get(shipment) ?? 0;
    const diff = declared - received;
    const next = [row.Store, shipment, row["Inbound Order ID"], declared, received, diff];
    if (diff <= 0) removed.push(next);
    else active.push(next);
  }
  latestCsv = toCsv(["Store", "Shipment ID", "Inbound Order ID", "Declared", "Received", "Final difference", "Status"], [
    ...active.map((row) => [...row, "Needs investigation"]),
    ...removed.map((row) => [...row, "Moved to review"])
  ]);
  document.querySelector("#walmart-result").innerHTML = `
    <h4>Rows that still need investigation</h4>
    ${table(["Store", "Shipment ID", "Inbound Order ID", "Declared", "Received", "Final difference"], active)}
    <h4>Rows moved to review sheet</h4>
    ${table(["Store", "Shipment ID", "Inbound Order ID", "Declared", "Received", "Final difference"], removed)}
    <div class="review-note">Rows with final difference <= 0 are separated for review instead of being silently ignored.</div>
  `;
}

function toCm(mm) {
  return (Number(mm || 0) / 10).toFixed(1).replace(/\.0$/, "");
}

function toKg(g) {
  return (Number(g || 0) / 1000).toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
}

function runAmazon() {
  const brand = document.querySelector("#az-brand").value.trim();
  const type = document.querySelector("#az-type").value.trim();
  const sku = document.querySelector("#az-sku").value.trim();
  const color = document.querySelector("#az-color").value.trim();
  const description = document.querySelector("#az-description").value.trim();
  const rows = [
    ["Item Name", `${brand} ${type}, ${color}`],
    ["Brand Name", brand],
    ["SKU", sku],
    ["Model / Part Number", `AU${type.split(" ").map((word) => word[0]).join("").toUpperCase()}${sku.replace(/^US/i, "")}`],
    ["Product Dimensions", `${toCm(document.querySelector("#az-length").value)} x ${toCm(document.querySelector("#az-width").value)} x ${toCm(document.querySelector("#az-height").value)} cm`],
    ["Product Weight", `${toKg(document.querySelector("#az-weight").value)} kg`],
    ["Color", color],
    ["Fulfillment Channel", "Fulfilment by Amazon"],
    ["Product Description", description]
  ];
  latestAmazonText = rows.map(([field, value]) => `${field}: ${value}`).join("\n");
  document.querySelector("#amazon-result").innerHTML = `
    <h4>Seller Central field preview</h4>
    ${table(["Field", "Copy-ready value"], rows)}
    <div class="review-note">Manual review required: title wording, bullet points, color map, and compliance-sensitive terms.</div>
  `;
}

document.querySelectorAll("[data-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-panel]").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#panel-${button.dataset.panel}`).classList.add("active");
  });
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.action === "goodcang") runGoodcang();
    if (button.dataset.action === "walmart") runWalmart();
    if (button.dataset.action === "amazon") runAmazon();
  });
});

document.querySelectorAll("[data-download]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.download === "goodcang") runGoodcang();
    if (button.dataset.download === "walmart") runWalmart();
    downloadText(`${button.dataset.download}-demo-output.csv`, latestCsv);
  });
});

document.querySelector("#wm-monthly-file").addEventListener("change", (event) => {
  readTextFile(event.target.files?.[0], "#wm-monthly");
});

document.querySelector("#wm-case-file").addEventListener("change", (event) => {
  readTextFile(event.target.files?.[0], "#wm-case");
});

document.querySelector("[data-reset='walmart']").addEventListener("click", () => {
  document.querySelector("#wm-monthly").value = walmartSampleMonthly;
  document.querySelector("#wm-case").value = walmartSampleCase;
  runWalmart();
});

document.querySelector("[data-copy='amazon']").addEventListener("click", async () => {
  runAmazon();
  try {
    await navigator.clipboard.writeText(latestAmazonText);
    document.querySelector("#amazon-result").insertAdjacentHTML("beforeend", `<div class="review-note">Copied generated fields to clipboard.</div>`);
  } catch {
    document.querySelector("#amazon-result").insertAdjacentHTML("beforeend", `<div class="review-note">Copy was blocked by the browser, but the generated fields are visible above.</div>`);
  }
});

document.querySelector("#module-search").addEventListener("input", (event) => {
  renderModules(event.target.value);
});

renderModules();
showModule("amazon");
runGoodcang();
