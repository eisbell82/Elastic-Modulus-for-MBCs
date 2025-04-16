import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";

let pyodide = null;
let groups = {
  "Control": { color: "#1f77b4", moduli: [] },
  "Treated": { color: "#ff7f0e", moduli: [] }
};
let currentModulus = null;

async function initPyodide() {
  pyodide = await loadPyodide();
  await pyodide.loadPackage(["pandas", "micropip", "scikit-learn"]);
  await pyodide.runPythonAsync(`
    import pandas as pd
    import numpy as np
    from io import StringIO
    from sklearn.linear_model import LinearRegression
    from scipy.signal import savgol_filter

    def process_csv(csv_text, min_strain, max_strain):
        df_raw = pd.read_csv(StringIO(csv_text), header=None)
        headers = [f"{n} {u}" if pd.notna(u) else n for n, u in zip(df_raw.iloc[0], df_raw.iloc[1])]
        df = df_raw[2:].reset_index(drop=True)
        df.columns = headers
        df = df.apply(pd.to_numeric, errors='coerce')

        strain_col = next(c for c in df.columns if 'strain' in c.lower() and '%' in c.lower())
        stress_col = next(c for c in df.columns if 'stress' in c.lower() and 'mpa' in c.lower())

        strain = df[strain_col].to_numpy() / 100
        stress = df[stress_col].to_numpy()
        smoothed = savgol_filter(stress, 11, 2)

        mask = (strain >= min_strain) & (strain <= max_strain)
        x_fit = strain[mask].reshape(-1, 1)
        y_fit = smoothed[mask]
        model = LinearRegression().fit(x_fit, y_fit)
        modulus = model.coef_[0]

        return {
            "strain": strain.tolist(),
            "stress": stress.tolist(),
            "smoothed": smoothed.tolist(),
            "modulus": modulus
        }
  `);
}

async function runAnalysis() {
  const fileInput = document.getElementById("csvFile");
  const minStrain = parseFloat(document.getElementById("strainMin").value);
  const maxStrain = parseFloat(document.getElementById("strainMax").value);
  if (!fileInput.files.length) return alert("Please select a CSV file.");
  const file = fileInput.files[0];
  const text = await file.text();
  const encoded = JSON.stringify(text);

  const result = await pyodide.runPythonAsync(`
    process_csv(${encoded}, ${minStrain}, ${maxStrain})
  `);

  const data = result.toJs();
  currentModulus = data.modulus;
  document.getElementById("modulusDisplay").innerText =
    \`Elastic Modulus: \${data.modulus.toFixed(3)} MPa\`;

  Plotly.newPlot("plot", [
    { x: data.strain, y: data.stress, name: "Raw", mode: "lines" },
    { x: data.strain, y: data.smoothed, name: "Smoothed", mode: "lines" }
  ], {
    title: "Stress-Strain Curve",
    xaxis: { title: "Strain" },
    yaxis: { title: "Stress (MPa)" }
  });
}

function assignToGroup() {
  if (currentModulus == null) return alert("Calculate a modulus first.");
  const group = document.getElementById("groupSelector").value;
  groups[group].moduli.push(currentModulus);
  plotGroupSummary();
}

function plotGroupSummary() {
  const labels = Object.keys(groups);
  const means = labels.map(g => math.mean(groups[g].moduli));
  const stds = labels.map(g => math.std(groups[g].moduli));
  const colors = labels.map(g => groups[g].color);

  Plotly.newPlot("groupPlot", [{
    x: labels,
    y: means,
    error_y: { type: 'data', array: stds, visible: true },
    type: 'bar',
    marker: { color: colors },
    name: "E-modulus"
  }], {
    title: "Grouped E-Modulus",
    yaxis: { title: "MPa" }
  });
}

function saveSession() {
  const blob = new Blob([JSON.stringify(groups, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "modulus_session.json";
  a.click();
}

document.getElementById("loadSessionFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  groups = JSON.parse(text);
  plotGroupSummary();
});

initPyodide();
window.runAnalysis = runAnalysis;
window.assignToGroup = assignToGroup;
window.saveSession = saveSession;
