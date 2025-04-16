let pyodideReady = false;
let pyodide = null;
let currentModuli = [];

async function initPyodide() {
  pyodide = await loadPyodide();
  await pyodide.loadPackage(['pandas', 'numpy', 'scikit-learn', 'scipy']);
  await pyodide.runPythonAsync(await (await fetch("modulus.py")).text());
  console.log("✅ Pyodide initialized. Ready.");
  pyodideReady = true;
}
initPyodide();

function log(msg) {
  document.getElementById("debug").textContent += msg + "\n";
}

async function runAnalysis() {
  if (!pyodideReady) {
    log("⚠️ Pyodide not ready yet.");
    return;
  }

  const input = document.getElementById("fileInput");
  if (!input.files.length) {
    log("⚠️ No files selected.");
    return;
  }

  document.getElementById("debug").textContent = "";
  const csv_texts = [];
  const names = [];

  for (const file of input.files) {
    const text = await file.text();
    csv_texts.push(text);
    if (i === 0) renderCsvPreview(text);
    names.push(file.name);




// === CSV Preview rendering from scratch ===
if (csv_texts.length > 0) {
  const previewText = csv_texts[0];
  const parsed = Papa.parse(previewText, { skipEmptyLines: true });
  const rows = parsed.data;
  if (rows.length < 3) {
    document.getElementById("dataBody").innerHTML = "<tr><td colspan='2'>Too few rows for preview</td></tr>";
    return;
  }

  const headerRow = rows[0].map(cell => cell.trim());
  const unitRow = rows[1].map(cell => cell.trim());
  const combinedHeaders = headerRow.map((label, i) => {
    const unit = unitRow[i] || "";
    return unit ? `${label} ${unit}` : label;
  });

  const strainIndex = combinedHeaders.findIndex(h => h.toLowerCase().includes("strain") && h.toLowerCase().includes("%"));
  const stressIndex = combinedHeaders.findIndex(h => h.toLowerCase().includes("stress") && h.toLowerCase().includes("mpa"));

  const tableBody = document.getElementById("dataBody");
  tableBody.innerHTML = "";

  if (strainIndex === -1 || stressIndex === -1) {
    const row = document.createElement("tr");
    row.innerHTML = "<td colspan='2'>Strain or stress column not found</td>";
    tableBody.appendChild(row);
    return;
  }

  const dataRows = rows.slice(2); // Skip headers
  let shown = 0;
  for (let i = 0; i < dataRows.length && shown < 20; i++) {
    const row = dataRows[i];
    const strainVal = parseFloat(row[strainIndex]);
    const stressVal = parseFloat(row[stressIndex]);
    if (!isNaN(strainVal) && !isNaN(stressVal)) {
      const tr = document.createElement("tr");
      const tdStrain = document.createElement("td");
      const tdStress = document.createElement("td");
      tdStrain.textContent = (strainVal / 100).toFixed(4);
      tdStress.textContent = stressVal.toFixed(2);
      tr.appendChild(tdStrain);
      tr.appendChild(tdStress);
      tableBody.appendChild(tr);
      shown++;
    }
  }

  if (shown === 0) {
    const row = document.createElement("tr");
    row.innerHTML = "<td colspan='2'>No valid numeric data found</td>";
    tableBody.appendChild(row);
  }
}


// Safe preview renderer
function renderCsvPreview(csvText) {
  const parsed = Papa.parse(csvText, { skipEmptyLines: true });
  const rows = parsed.data;
  if (rows.length < 3) {
    document.getElementById("dataBody").innerHTML = "<tr><td colspan='2'>Too few rows for preview</td></tr>";
    return;
  }

  const headers = rows[0].map(cell => cell.trim());
  const units = rows[1].map(cell => cell.trim());
  const combinedHeaders = headers.map((label, i) => {
    const unit = units[i] || "";
    return unit ? `${label} ${unit}` : label;
  });

  const strainIndex = combinedHeaders.findIndex(h => h.toLowerCase().includes("strain") && h.toLowerCase().includes("%"));
  const stressIndex = combinedHeaders.findIndex(h => h.toLowerCase().includes("stress") && h.toLowerCase().includes("mpa"));

  const dataRows = rows.slice(2);
  const tableBody = document.getElementById("dataBody");
  tableBody.innerHTML = "";

  if (strainIndex === -1 || stressIndex === -1) {
    tableBody.innerHTML = "<tr><td colspan='2'>Strain or stress column not found</td></tr>";
    return;
  }

  let shown = 0;
  for (let i = 0; i < dataRows.length && shown < 20; i++) {
    const row = dataRows[i];
    const strainVal = parseFloat(row[strainIndex]);
    const stressVal = parseFloat(row[stressIndex]);
    if (!isNaN(strainVal) && !isNaN(stressVal)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${(strainVal / 100).toFixed(4)}</td><td>${stressVal.toFixed(2)}</td>`;
      tableBody.appendChild(tr);
      shown++;
    }
  }

  if (shown === 0) {
    tableBody.innerHTML = "<tr><td colspan='2'>No valid numeric data</td></tr>";
  }
}
}
