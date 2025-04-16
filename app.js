import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";

let pyodide = null;
let groups = {};
let currentModulus = null;

function refreshGroupSelector() {
  const select = document.getElementById("groupSelector");
  select.innerHTML = "";
  for (const name in groups) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
}

function addGroup() {
  const name = document.getElementById("newGroupName").value.trim();
  const color = document.getElementById("newGroupColor").value;
  if (!name || groups[name]) return alert("Enter a unique group name.");
  groups[name] = { color: color, moduli: [] };
  refreshGroupSelector();
}

function deleteGroup() {
  const name = document.getElementById("groupSelector").value;
  if (groups[name]) {
    delete groups[name];
    refreshGroupSelector();
    plotGroupSummary();
  }
}

function assignToGroup() {
  if (!currentModulus) return alert("Calculate modulus first.");
  const name = document.getElementById("groupSelector").value;
  if (!groups[name]) return alert("Group does not exist.");
  groups[name].moduli.push(currentModulus);
  plotGroupSummary();
}

function plotGroupSummary() {
  const labels = Object.keys(groups);
  const means = labels.map(g => math.mean(groups[g].moduli) || 0);
  const stds = labels.map(g => math.std(groups[g].moduli) || 0);
  const colors = labels.map(g => groups[g].color || "#000");

  Plotly.newPlot("groupPlot", [{
    x: labels,
    y: means,
    error_y: { type: "data", array: stds, visible: true },
    marker: { color: colors },
    type: "bar",
    name: "E-Mod"
  }], {
    title: "Grouped Elastic Modulus",
    yaxis: { title: "MPa" }
  });
}

function saveSession() {
  const blob = new Blob([JSON.stringify(groups, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "session.json";
  a.click();
}

document.getElementById("loadSessionFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  groups = JSON.parse(text);
  refreshGroupSelector();
  plotGroupSummary();
});

async function initPyodide() {
  pyodide = await loadPyodide();
  await pyodide.loadPackage(["pandas", "scikit-learn"]);
  await pyodide.runPythonAsync(`
    import pandas as pd
    import numpy as np
    from io import StringIO
    from sklearn.linear_model import LinearRegression
    from scipy.signal import savgol_filter

    def process_csv_all(csv_texts, min_strain, max_strain):
        all_strain = []
        all_stress = []
        for csv_text in csv_texts:
            df_raw = pd.read_csv(StringIO(csv_text), header=None)
            headers = [f"{n} {u}" if pd.notna(u) else n for n, u in zip(df_raw.iloc[0], df_raw.iloc[1])]
            df = df_raw[2:].reset_index(drop=True)
            df.columns = headers
            df = df.apply(pd.to_numeric, errors='coerce')
            print("Available columns:", df.columns)

            strain_col = next(c for c in df.columns if 'strain' in c.lower() and '%' in c.lower())
            stress_col = next(c for c in df.columns if 'stress' in c.lower() and 'mpa' in c.lower())

            strain = df[strain_col].to_numpy() / 100
            stress = df[stress_col].to_numpy()
            smoothed = savgol_filter(stress, 11, 2)

            all_strain.append(strain)
            all_stress.append(smoothed)

        common = np.linspace(0, max(max(s) for s in all_strain), 1000)
        interpolated = [np.interp(common, s, f) for s, f in zip(all_strain, all_stress)]
        avg_stress = np.mean(interpolated, axis=0)

        mask = (common >= min_strain) & (common <= max_strain)
        x_fit = common[mask].reshape(-1, 1)
        y_fit = avg_stress[mask]
        model = LinearRegression().fit(x_fit, y_fit)
        modulus = model.coef_[0]

        return {
            "strain": common.tolist(),
            "avg_stress": avg_stress.tolist(),
            "modulus": modulus
        }
  `);
}

async function runAnalysis() {
  const input = document.getElementById("csvFile");
  const minStrain = parseFloat(document.getElementById("strainMin").value);
  const maxStrain = parseFloat(document.getElementById("strainMax").value);
  if (!input.files.length) return alert("No CSVs selected.");

  try {
    const csv_texts = [];
    for (const file of input.files) {
      const text = await file.text();
      csv_texts.push(text);
    }

    const encoded = JSON.stringify(csv_texts);
    const result = await pyodide.runPythonAsync(`
      process_csv_all(${encoded}, ${minStrain}, ${maxStrain})
    `);

    const data = result.toJs();
    currentModulus = data.modulus;
    document.getElementById("modulusDisplay").innerText =
      \`Elastic Modulus: \${data.modulus.toFixed(3)} MPa\`;

    Plotly.newPlot("plot", [
      { x: data.strain, y: data.avg_stress, name: "Average Smoothed", mode: "lines" }
    ], {
      title: "Average Stress-Strain Curve",
      xaxis: { title: "Strain" },
      yaxis: { title: "Stress (MPa)" }
    });
  } catch (err) {
    alert("Error during analysis. Check console for details.");
    console.error("Error in Pyodide execution:", err);
  }
}

initPyodide();
window.runAnalysis = runAnalysis;
window.addGroup = addGroup;
window.deleteGroup = deleteGroup;
window.assignToGroup = assignToGroup;
window.saveSession = saveSession;
