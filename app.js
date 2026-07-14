const productNameMap = {
  "毛巾架": "Towel rack",
  "浴室架": "Shower caddy",
  "砧板": "Cutting board",
  "收纳架": "Storage rack",
  "鞋架": "Shoe rack"
};

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
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map((x) => x.trim());
  return lines.map((line) => {
    const values = line.split(",").map((x) => x.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function runGoodcang() {
  const sku = document.querySelector("#gc-sku").value.trim();
  const cnName = document.querySelector("#gc-cn").value.trim();
  const englishBase = productNameMap[cnName] || "Product";
  const output = [
    ["商品编码", sku],
    ["中文申报品名", cnName],
    ["英文名称", `${englishBase} / ${sku}`],
    ["材质", document.querySelector("#gc-material").value.trim()],
    ["商品链接", document.querySelector("#gc-url").value.trim()],
    ["出口申报单价 USD", document.querySelector("#gc-export").value.trim()],
    ["进口申报单价 USD", document.querySelector("#gc-import").value.trim()]
  ];
  document.querySelector("#goodcang-output").innerHTML = `
    <h4>Generated warehouse upload preview</h4>
    ${table(["Field", "Value"], output)}
    <div class="review-note">Review required: English name, product URL, and declaration prices should be checked before upload.</div>
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
  document.querySelector("#walmart-output").innerHTML = `
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
  document.querySelector("#amazon-output").innerHTML = `
    <h4>Seller Central field preview</h4>
    ${table(["Field", "Copy-ready value"], rows)}
    <div class="review-note">Manual review required: title wording, bullet points, color map, and compliance-sensitive terms.</div>
  `;
}

document.querySelectorAll("[data-demo-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".demo-tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".demo-panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#demo-${button.dataset.demoTab}`).classList.add("active");
  });
});

document.querySelectorAll("[data-run-demo]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.runDemo === "goodcang") runGoodcang();
    if (button.dataset.runDemo === "walmart") runWalmart();
    if (button.dataset.runDemo === "amazon") runAmazon();
  });
});

runGoodcang();
