
import pandas as pd
import numpy as np
from io import StringIO
from sklearn.linear_model import LinearRegression
from scipy.signal import savgol_filter

def process_csv_all(csv_texts, min_strain, max_strain, window, order):
    curves = []
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
        smoothed = savgol_filter(stress, int(window), int(order))

        mask = (strain >= min_strain) & (strain <= max_strain)
        x_fit = strain[mask].reshape(-1, 1)
        y_fit = smoothed[mask]

        result = {
            'strain_column': strain_col,
            'stress_column': stress_col,
            'strain_values': strain[:20].tolist(),
            'stress_values': stress[:20].tolist(),
            'strain': strain.tolist(),
            'stress': stress.tolist(),
            'smoothed': smoothed.tolist(),
            'fit_x': [],
            'fit_y': [],
            'modulus': None,
            'r2': None
        }

        print(f"→ Total strain points: {len(strain)}")
        print(f"→ Points in range ({min_strain}-{max_strain}): {len(x_fit)}")

        if len(x_fit) >= 2:
            model = LinearRegression().fit(x_fit, y_fit)
            result['modulus'] = model.coef_[0]
            result['r2'] = model.score(x_fit, y_fit)
            result['fit_x'] = x_fit.flatten().tolist()
            result['fit_y'] = model.predict(x_fit).tolist()

        curves.append(result)

    return curves
