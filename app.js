
let pyodide = null;
let currentModuli = [];

function log(msg) {
  const out = document.getElementById("debugLog");
  if (out) out.textContent += `\n${msg}`;
  console.log(msg);
}

async function runAnalysis() {
  const input = document.getElementById("csvFile");
  const minStrain = parseFloat(document.getElementById("strainMin").value);
  const maxStrain = parseFloat(document.getElementById("strainMax").value);
  const smoothWin = parseInt(document.getElementById("smoothingWindow").value);
  const polyOrder = parseInt(document.getElementById("polyOrder").value);
  if (!input.files.length) return alert("No CSVs selected.");

  try {
    const csv_texts = [];
    const names = [];
    for (const file of input.files) {
      const text = await file.text();
      csv_texts.push(text);
      names.push(file.name);
    }

    pyodide.globals.set("js_csvs", csv_texts);
    pyodide.globals.set("js_min", minStrain);
    pyodide.globals.set("js_max", maxStrain);
    pyodide.globals.set("js_window", smoothWin);
    pyodide.globals.set("js_order", polyOrder);

    log("Running Pyodide analysis...");
    await pyodide.runPythonAsync("results = process_csv_all(js_csvs, js_min, js_max, js_window, js_order)");
    const curves = pyodide.globals.get("results").toJs({ dict_converter: Object.fromEntries });

    currentModuli = [];
    const traces = [];
    const tableBody = document.getElementById("usedDataBody");
    tableBody.innerHTML = '';

    curves.forEach((curve, i) => {
      log(`\n[${i}] ${names[i]} → keys: ${Object.keys(curve).join(', ')}`);
      log(`  strain_values: ${curve.strain_values?.length ?? "missing"}, stress_values: ${curve.stress_values?.length ?? "missing"}`);
if (curve.strain_values) log(`  first strain: ${curve.strain_values[0]}`);
if (curve.stress_values) log(`  first stress: ${curve.stress_values[0]}`);
      const label = names[i];
      traces.push({ x: curve.strain, y: curve.stress, name: `${label} raw`, mode: "lines", line: { dash: "dot" } });
    const row = document.createElement('tr');
    row.innerHTML = `<td>${label}</td><td>${curve.strain_column}</td><td>${curve.stress_column}</td>`;
    tableBody.appendChild(row);
    if (i === 0) {
      const dataBody = document.getElementById('dataPreviewBody');
      dataBody.innerHTML = '';
      for (let j = 0; j < Math.min(curve.strain_values.length, curve.stress_values.length); j++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${curve.strain_values[j].toFixed(5)}</td><td>${curve.stress_values[j].toFixed(3)}</td>`;
        dataBody.appendChild(tr);
      }
    }
      traces.push({ x: curve.strain, y: curve.smoothed, name: `${label} smoothed`, mode: "lines" });
      if (curve.modulus !== null) {
        if (typeof curve.modulus === "number" && typeof curve.r2 === "number") {
        traces.push({ x: curve.fit_x, y: curve.fit_y, name: `${label} fit (${curve.modulus.toFixed(2)} MPa, R²=${curve.r2.toFixed(2)})`, mode: "lines", line: { dash: "dash" } });
        currentModuli.push(curve.modulus);
      } else {
        log(`⚠️ ${label}: Not enough points in strain range for fit`);
      }
      } else {
        log(`⚠️ ${label}: Not enough data in range for fitting`);
      }
    });

    document.getElementById("modulusDisplay").innerText =
      currentModuli.length
        ? `Avg Modulus: ${math.mean(currentModuli).toFixed(2)} ± ${math.std(currentModuli).toFixed(2)} MPa`
        : "No valid fits.";

    Plotly.newPlot("plot", traces, {
      title: "Per-File Stress-Strain Curves",
      xaxis: { title: "Strain" },
      yaxis: { title: "Stress (MPa)" }
    });

  } catch (err) {
    log("❌ Error during analysis. See JS console.");
    console.error(err);
  }
}

async function initPyodide() {
  pyodide = await loadPyodide();
  await pyodide.loadPackage(["pandas", "scikit-learn"]);
  const code = await (await fetch("modulus.py")).text();
  await pyodide.runPythonAsync(code);
  window.runAnalysis = runAnalysis;
  log("✅ Pyodide initialized. Ready.");
}

initPyodide();
