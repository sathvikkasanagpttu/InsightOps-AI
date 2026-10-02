from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import re
import pandas as pd
import numpy as np
from io import BytesIO
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression

app = FastAPI(title="InsightOps AI API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "sample" / "sales.csv"
DATA = pd.read_csv(DATA_PATH)
DATA["date"] = pd.to_datetime(DATA["date"])
DATA_SOURCE = DATA_PATH.name
ACTIVE_ANALYSIS_MODE = "sales"
ACTIVE_DATASET = None
ACTIVE_ANALYSIS = None
REQUIRED_COLUMNS = {"date", "category", "region", "revenue", "orders", "customers", "profit"}
COLUMN_ALIASES = {
    "date": {"date", "created", "created_at", "order_date", "transaction_date", "sales_date", "invoice_date"},
    "category": {"category", "product_category", "item_category", "product_type"},
    "region": {"region", "sales_region", "territory", "market", "state", "location"},
    "revenue": {"revenue", "sales", "total_sales", "sales_amount", "total_revenue", "net_sales"},
    "orders": {"orders", "order_count", "total_orders", "number_of_orders"},
    "customers": {"customers", "customer_count", "unique_customers", "number_of_customers"},
    "profit": {"profit", "net_profit", "gross_profit", "earnings"}
}

def normalize_dataset_columns(df):
    aliases = {alias: canonical for canonical, values in COLUMN_ALIASES.items() for alias in values}
    rename = {}
    mapped = {}
    normalized_columns = set()
    for column in df.columns:
        normalized = re.sub(r"[^a-z0-9]+", "_", str(column).strip().lower()).strip("_")
        canonical = aliases.get(normalized, normalized)
        if canonical in normalized_columns:
            raise HTTPException(status_code=400, detail=f"Multiple CSV columns normalize to '{canonical}'.")
        normalized_columns.add(canonical)
        rename[column] = canonical
        if canonical in REQUIRED_COLUMNS:
            if canonical in mapped:
                raise HTTPException(status_code=400, detail=f"Multiple CSV columns map to '{canonical}': {mapped[canonical]} and {column}.")
            mapped[canonical] = str(column)
    return df.rename(columns=rename)

def clean_dataset(df):
    df = df.copy()
    df.columns = [str(column).strip() for column in df.columns]
    for column in df.select_dtypes(include=["object"]).columns:
        df[column] = df[column].map(lambda value: value.strip() if isinstance(value, str) else value)
    return df

def analyze_generic_dataset(df, filename):
    date_column = next((column for column in df.columns if column in {"date", "created_at", "timestamp"}), None)
    if date_column:
        parsed_dates = pd.to_datetime(df[date_column], errors="coerce")
        if parsed_dates.notna().sum() >= max(1, int(len(df) * 0.7)):
            df[date_column] = parsed_dates
        else:
            date_column = None

    profile = dataset_profile(df)
    columns = []
    distributions = []
    sensitive_names = {"email", "mobile", "phone", "address"}
    for column in df.columns:
        series = df[column]
        missing = int(series.isna().sum())
        unique_values = int(series.nunique(dropna=True))
        columns.append({"name": column, "dtype": str(series.dtype), "missing_values": missing,
                        "unique_values": unique_values})
        if (series.dtype == "object" and column not in sensitive_names
                and 0 < unique_values <= 30):
            counts = series.value_counts(dropna=True).head(8)
            distributions.append({"column": column, "values": [
                {"value": str(value), "count": int(count)} for value, count in counts.items()
            ]})

    timeline = []
    date_range = None
    if date_column:
        dates = df[date_column].dropna()
        if not dates.empty:
            date_range = {"start": dates.min().strftime("%Y-%m-%d"),
                          "end": dates.max().strftime("%Y-%m-%d")}
            grouped = df.dropna(subset=[date_column]).groupby(df[date_column].dt.to_period("M")).size()
            timeline = [{"month": period.strftime("%b %Y"), "records": int(count)}
                        for period, count in grouped.items()]

    quality_alerts = []
    if profile["duplicates"]:
        quality_alerts.append({"title": "Duplicate rows", "detail": f"{profile['duplicates']} duplicate rows found.", "severity": "medium"})
    for column in columns:
        if column["missing_values"]:
            quality_alerts.append({"title": f"Missing values: {column['name']}",
                                   "detail": f"{column['missing_values']} rows have no value for this field.",
                                   "severity": "medium"})

    return {"analysis_mode": "generic", "filename": filename, **profile, "columns": columns,
            "date_column": date_column, "date_range": date_range, "timeline": timeline,
            "distributions": distributions, "quality_alerts": quality_alerts}

def dataset_profile(df):
    missing = int(df.isna().sum().sum())
    duplicates = int(df.duplicated().sum())
    cells = max(df.shape[0] * df.shape[1], 1)
    score = max(0, 100 - missing / cells * 100 - min(duplicates / max(df.shape[0], 1) * 20, 20))
    return {"rows": len(df), "column_count": len(df.columns), "missing_values": missing,
            "duplicates": duplicates, "quality_score": round(score, 1),
            "columns": [{"name": c, "dtype": str(df[c].dtype)} for c in df.columns]}

def monthly():
    x = DATA.set_index("date").resample("MS").agg(
        revenue=("revenue","sum"), orders=("orders","sum"),
        customers=("customers","sum"), profit=("profit","sum")
    ).reset_index()
    return x

@app.get("/api/health")
def health():
    return {"status":"healthy","service":"InsightOps AI","version":"1.0.0"}

@app.get("/api/overview")
def overview():
    if ACTIVE_ANALYSIS_MODE == "generic":
        return {"analysis_mode": "generic", "records": len(ACTIVE_DATASET),
                "columns": len(ACTIVE_DATASET.columns),
                "missing_values": ACTIVE_ANALYSIS["missing_values"],
                "duplicates": ACTIVE_ANALYSIS["duplicates"],
                "quality_score": ACTIVE_ANALYSIS["quality_score"]}
    m = monthly()
    latest = m.iloc[-1]
    prev = m.iloc[-2] if len(m) > 1 else None
    revenue = float(DATA.revenue.sum())
    orders = int(DATA.orders.sum())
    customers = int(DATA.customers.sum())
    profit = float(DATA.profit.sum())
    growth = (latest.revenue / prev.revenue - 1) * 100 if prev is not None and prev.revenue else 0
    return {
        "revenue": round(revenue,2), "orders": orders, "customers": customers,
        "profit": round(profit,2), "growth": round(growth,2),
        "aov": round(revenue / orders, 2) if orders else 0,
        "margin": round(profit / revenue * 100, 2) if revenue else 0
    }

@app.get("/api/trends")
def trends():
    if ACTIVE_ANALYSIS_MODE == "generic":
        return ACTIVE_ANALYSIS["timeline"]
    m = monthly()
    return [{"month": d.strftime("%b %Y"), "revenue": round(float(r),2),
             "profit": round(float(p),2), "orders": int(o)}
            for d,r,p,o in zip(m.date,m.revenue,m.profit,m.orders)]

@app.get("/api/categories")
def categories():
    if ACTIVE_ANALYSIS_MODE == "generic":
        return ACTIVE_ANALYSIS["distributions"]
    x = DATA.groupby("category", as_index=False).agg(revenue=("revenue","sum"), profit=("profit","sum"))
    x = x.sort_values("revenue", ascending=False)
    return x.round(2).to_dict(orient="records")

@app.get("/api/regions")
def regions():
    if ACTIVE_ANALYSIS_MODE == "generic":
        return next((item["values"] for item in ACTIVE_ANALYSIS["distributions"]
                     if item["column"] == "region"), [])
    x = DATA.groupby("region", as_index=False).agg(revenue=("revenue","sum"), orders=("orders","sum"))
    return x.round(2).to_dict(orient="records")

@app.get("/api/anomalies")
def anomalies():
    if ACTIVE_ANALYSIS_MODE == "generic":
        return ACTIVE_ANALYSIS["quality_alerts"]
    m = monthly()
    if len(m) > 1:
        model = IsolationForest(contamination=0.2, random_state=42)
        m["flag"] = model.fit_predict(m[["revenue", "orders", "profit"]])
        out = m[m.flag == -1]
    else:
        out = m
    if out.empty:
        out = m.tail(1)
    return [{"month": d.strftime("%B %Y"), "revenue": round(float(r),2),
             "severity":"high" if r < m.revenue.mean()*0.9 else "medium"}
            for d,r in zip(out.date,out.revenue)]

@app.get("/api/forecast")
def forecast():
    if ACTIVE_ANALYSIS_MODE == "generic":
        timeline = ACTIVE_ANALYSIS["timeline"]
        if len(timeline) < 2:
            return []
        values = np.array([item["records"] for item in timeline])
        X = np.arange(len(values)).reshape(-1, 1)
        model = LinearRegression().fit(X, values)
        future_x = np.arange(len(values), len(values) + 4).reshape(-1, 1)
        return [{"period": f"Forecast +{index + 1}", "records": max(0, round(float(value), 1))}
                for index, value in enumerate(model.predict(future_x))]
    m = monthly()
    y = m.revenue.values
    X = np.arange(len(y)).reshape(-1,1)
    model = LinearRegression().fit(X,y)
    future_x = np.arange(len(y), len(y)+4).reshape(-1,1)
    preds = model.predict(future_x)
    return [{"period": f"Forecast +{i+1}", "revenue": round(float(v),2)}
            for i,v in enumerate(preds)]

@app.post("/api/profile")
async def profile(file: UploadFile = File(...)):
    try:
        df = pd.read_csv(BytesIO(await file.read()))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {exc}") from exc
    return dataset_profile(df)

@app.get("/api/dataset")
def current_dataset():
    if ACTIVE_ANALYSIS_MODE == "generic":
        return ACTIVE_ANALYSIS
    return {"analysis_mode": "sales", "filename": DATA_SOURCE, **dataset_profile(DATA)}

@app.post("/api/dataset")
async def upload_dataset(file: UploadFile = File(...)):
    global DATA, DATA_SOURCE, ACTIVE_ANALYSIS_MODE, ACTIVE_DATASET, ACTIVE_ANALYSIS
    try:
        df = pd.read_csv(BytesIO(await file.read()), sep=None, engine="python")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {exc}") from exc
    if df.empty:
        raise HTTPException(status_code=400, detail="The CSV has no data rows.")
    df = normalize_dataset_columns(df)
    missing_columns = sorted(REQUIRED_COLUMNS - set(df.columns))
    df = clean_dataset(df)
    if missing_columns:
        DATA_SOURCE = file.filename or "uploaded.csv"
        ACTIVE_ANALYSIS_MODE = "generic"
        ACTIVE_DATASET = df
        ACTIVE_ANALYSIS = analyze_generic_dataset(df, DATA_SOURCE)
        return ACTIVE_ANALYSIS
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    numeric_columns = ["revenue", "orders", "customers", "profit"]
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    invalid_rows = df[ ["date", *numeric_columns] ].isna().any(axis=1)
    if invalid_rows.any():
        raise HTTPException(status_code=400, detail="Date and metric columns must contain valid values in every row.")
    DATA = df
    DATA_SOURCE = file.filename or "uploaded.csv"
    ACTIVE_ANALYSIS_MODE = "sales"
    ACTIVE_DATASET = DATA
    ACTIVE_ANALYSIS = None
    return {"analysis_mode": "sales", "filename": DATA_SOURCE, **dataset_profile(DATA)}

@app.get("/api/ask")
def ask(q: str):
    ql=q.lower()
    if ACTIVE_ANALYSIS_MODE == "generic":
        for distribution in ACTIVE_ANALYSIS["distributions"]:
            if distribution["column"] in ql:
                values = distribution["values"]
                breakdown = ", ".join(f"{item['value']}: {item['count']}" for item in values[:6])
                return {"answer": f"Records by {distribution['column']}: {breakdown or 'no values available.'}",
                        "evidence": [f"Dataset: {DATA_SOURCE}", f"Rows: {ACTIVE_ANALYSIS['rows']}"]}
        time_range = ACTIVE_ANALYSIS["date_range"]
        date_summary = (f"Date range: {time_range['start']} to {time_range['end']}"
                        if time_range else "No date field could be identified.")
        return {"answer": f"{DATA_SOURCE} contains {ACTIVE_ANALYSIS['rows']} records and {ACTIVE_ANALYSIS['column_count']} fields. {date_summary}",
                "evidence": [f"Missing values: {ACTIVE_ANALYSIS['missing_values']}",
                             f"Duplicate rows: {ACTIVE_ANALYSIS['duplicates']}",
                             f"Data quality score: {ACTIVE_ANALYSIS['quality_score']}%"]}
    ov=overview()
    if "revenue" in ql and ("why" in ql or "decrease" in ql):
        cats=categories()
        top=cats[0]
        return {"answer":f"Revenue performance is led by {top['category']}, which contributes ₹{top['revenue']:,.0f}. Review the latest monthly anomaly and regional mix for the strongest drivers.",
                "evidence":[f"Total revenue: ₹{ov['revenue']:,.0f}", f"AOV: ₹{ov['aov']:,.0f}", f"Top category: {top['category']}"]}
    return {"answer":f"I found ₹{ov['revenue']:,.0f} in recorded revenue across {ov['orders']:,} orders. Try asking about revenue, categories, regions, anomalies, or forecast.",
            "evidence":[f"Margin: {ov['margin']}%", f"Customers: {ov['customers']:,}"]}
