from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


ELASTICITY_COEFFICIENTS = {
    "inelastic": -0.4,    # Low price sensitivity (monopolistic / mission critical)
    "moderate": -0.95,    # Average enterprise SaaS / B2B goods
    "elastic": -1.65      # Highly competitive / consumer commodities
}


def extract_baseline_business_metrics(df: pd.DataFrame) -> Dict[str, float]:
    """
    Extracts or models baseline enterprise metrics from the active dataset.
    """
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    
    # Revenue
    rev_col = None
    for c in numeric_cols:
        if any(k in c.lower() for k in ["revenue", "sales", "total", "amount", "mrr"]):
            rev_col = c
            break
    if not rev_col and numeric_cols:
        rev_col = numeric_cols[0]

    baseline_revenue = float(pd.to_numeric(df[rev_col], errors="coerce").dropna().sum()) if rev_col else 1500000.0
    if baseline_revenue <= 0:
        baseline_revenue = 1500000.0

    # Volume / Order count / Customers
    vol_col = None
    for c in numeric_cols:
        if any(k in c.lower() for k in ["orders", "quantity", "units", "customers", "active_users"]):
            vol_col = c
            break
    baseline_volume = float(pd.to_numeric(df[vol_col], errors="coerce").dropna().sum()) if vol_col else max(len(df) * 15, 1200)

    # Average price per unit / ARPU
    baseline_avg_price = round(baseline_revenue / max(baseline_volume, 1.0), 2)

    # Modeled cost structure
    gross_margin_pct = 72.0
    cogs = round(baseline_revenue * ((100.0 - gross_margin_pct) / 100.0), 2)
    gross_profit = round(baseline_revenue - cogs, 2)
    marketing_spend = round(baseline_revenue * 0.18, 2)
    operating_expenses = round(baseline_revenue * 0.35, 2)
    net_operating_profit = round(gross_profit - (marketing_spend + operating_expenses), 2)
    cac = round(marketing_spend / max(baseline_volume * 0.25, 1.0), 2)
    churn_rate_pct = 3.2

    return {
        "baseline_revenue": round(baseline_revenue, 2),
        "baseline_volume": round(baseline_volume, 0),
        "baseline_avg_price": baseline_avg_price,
        "gross_margin_pct": gross_margin_pct,
        "baseline_cogs": cogs,
        "baseline_gross_profit": gross_profit,
        "baseline_marketing_spend": marketing_spend,
        "baseline_operating_expenses": operating_expenses,
        "baseline_net_profit": net_operating_profit,
        "baseline_cac": cac,
        "baseline_churn_rate_pct": churn_rate_pct
    }


def simulate_business_scenario(
    baseline: Dict[str, float],
    price_change_pct: float = 0.0,
    marketing_spend_pct: float = 0.0,
    churn_reduction_pct: float = 0.0,
    conversion_rate_pct: float = 0.0,
    elasticity_model: str = "moderate"
) -> Dict[str, Any]:
    """
    Simulates business outcomes using econometric demand elasticity models
    and marginal cost curves.
    """
    elasticity = ELASTICITY_COEFFICIENTS.get(elasticity_model.lower(), -0.95)

    p_base = baseline["baseline_avg_price"]
    q_base = baseline["baseline_volume"]
    rev_base = baseline["baseline_revenue"]
    mktg_base = baseline["baseline_marketing_spend"]
    gm_pct = baseline["gross_margin_pct"]
    opex_base = baseline["baseline_operating_expenses"]
    churn_base = baseline["baseline_churn_rate_pct"]

    # 1. Price Lever
    p_mult = 1.0 + (price_change_pct / 100.0)
    p_sim = max(p_base * p_mult, 0.01)
    
    # Price elasticity impact on demand volume
    q_elasticity_impact = (price_change_pct / 100.0) * elasticity

    # 2. Marketing Spend Lever (with diminishing marginal returns exponent 0.65)
    m_mult = 1.0 + (marketing_spend_pct / 100.0)
    mktg_sim = max(mktg_base * m_mult, 0.0)
    mktg_growth_factor = max(m_mult, 0.01) ** 0.65 - 1.0

    # 3. Conversion Rate Lever
    conv_growth_factor = conversion_rate_pct / 100.0

    # Combined volume multiplier
    net_volume_multiplier = max(0.1, 1.0 + q_elasticity_impact + mktg_growth_factor + conv_growth_factor)
    q_sim = round(q_base * net_volume_multiplier, 0)

    # 4. Projected Revenue
    rev_sim = round(q_sim * p_sim, 2)

    # 5. Churn Reduction Lever
    effective_churn_reduction = max(0.0, min(churn_reduction_pct / 100.0, 0.8))
    churn_sim = round(churn_base * (1.0 - effective_churn_reduction), 2)
    retained_revenue_bonus = round(rev_base * (effective_churn_reduction * (churn_base / 100.0)), 2)
    
    total_projected_revenue = round(rev_sim + retained_revenue_bonus, 2)

    # 6. Cost & Profitability Projections
    cogs_sim = round(total_projected_revenue * ((100.0 - gm_pct) / 100.0), 2)
    gross_profit_sim = round(total_projected_revenue - cogs_sim, 2)
    net_profit_sim = round(gross_profit_sim - (mktg_sim + opex_base), 2)

    # 7. Unit Economics Simulation
    new_customers_sim = round(q_sim * 0.25, 0)
    cac_sim = round(mktg_sim / max(new_customers_sim, 1.0), 2)
    ltv_sim = round((p_sim * 12.0 * (gm_pct / 100.0)) / max(churn_sim / 100.0, 0.01), 2)
    ltv_cac_sim = round(ltv_sim / max(cac_sim, 1.0), 2)

    # 8. Variances
    rev_delta = round(total_projected_revenue - rev_base, 2)
    rev_delta_pct = round((rev_delta / max(rev_base, 1.0)) * 100.0, 2)
    profit_delta = round(net_profit_sim - baseline["baseline_net_profit"], 2)
    profit_delta_pct = round((profit_delta / max(abs(baseline["baseline_net_profit"]), 1.0)) * 100.0, 2)

    # 9. Waterfall Breakdown Components
    price_impact_val = round((p_sim - p_base) * q_base, 2)
    elasticity_impact_val = round(q_base * q_elasticity_impact * p_sim, 2)
    mktg_impact_val = round(q_base * mktg_growth_factor * p_sim, 2)
    conv_impact_val = round(q_base * conv_growth_factor * p_sim, 2)

    waterfall = [
        {"name": "Baseline Revenue", "value": rev_base, "type": "baseline"},
        {"name": "Price Effect", "value": price_impact_val, "type": "positive" if price_impact_val >= 0 else "negative"},
        {"name": "Demand Elasticity Drag", "value": elasticity_impact_val, "type": "positive" if elasticity_impact_val >= 0 else "negative"},
        {"name": "Marketing Acquisition Lift", "value": mktg_impact_val, "type": "positive" if mktg_impact_val >= 0 else "negative"},
        {"name": "Conversion Uplift", "value": conv_impact_val, "type": "positive" if conv_impact_val >= 0 else "negative"},
        {"name": "Retention Savings", "value": retained_revenue_bonus, "type": "positive" if retained_revenue_bonus >= 0 else "negative"},
        {"name": "Projected Revenue", "value": total_projected_revenue, "type": "total"}
    ]

    # 10. Sensitivity Sweep (-20% to +20% for Price and Ad Spend)
    sensitivity_price_curve = []
    for delta in [-20, -15, -10, -5, 0, 5, 10, 15, 20]:
        sweep_p = p_base * (1.0 + delta / 100.0)
        sweep_q = q_base * (1.0 + (delta / 100.0) * elasticity)
        sweep_rev = round(sweep_p * sweep_q, 2)
        sweep_profit = round((sweep_rev * (gm_pct / 100.0)) - (mktg_base + opex_base), 2)
        sensitivity_price_curve.append({
            "delta_pct": delta,
            "label": f"{delta:+d}%",
            "revenue": sweep_rev,
            "profit": sweep_profit
        })

    sensitivity_spend_curve = []
    for delta in [-30, -20, -10, 0, 10, 20, 30]:
        sweep_m = mktg_base * (1.0 + delta / 100.0)
        m_lift = max(1.0 + delta / 100.0, 0.01) ** 0.65 - 1.0
        sweep_q = q_base * (1.0 + m_lift)
        sweep_rev = round(sweep_q * p_base, 2)
        sweep_profit = round((sweep_rev * (gm_pct / 100.0)) - (sweep_m + opex_base), 2)
        sensitivity_spend_curve.append({
            "delta_pct": delta,
            "label": f"{delta:+d}%",
            "spend": round(sweep_m, 2),
            "revenue": sweep_rev,
            "profit": sweep_profit
        })

    return {
        "inputs": {
            "price_change_pct": price_change_pct,
            "marketing_spend_pct": marketing_spend_pct,
            "churn_reduction_pct": churn_reduction_pct,
            "conversion_rate_pct": conversion_rate_pct,
            "elasticity_model": elasticity_model,
            "elasticity_coefficient": elasticity
        },
        "baseline": baseline,
        "projected": {
            "revenue": total_projected_revenue,
            "net_profit": net_profit_sim,
            "gross_profit": gross_profit_sim,
            "volume_units": q_sim,
            "avg_price": p_sim,
            "marketing_spend": mktg_sim,
            "churn_rate_pct": churn_sim,
            "cac": cac_sim,
            "ltv": ltv_sim,
            "ltv_cac_ratio": ltv_cac_sim
        },
        "variance": {
            "revenue_delta": rev_delta,
            "revenue_delta_pct": rev_delta_pct,
            "profit_delta": profit_delta,
            "profit_delta_pct": profit_delta_pct,
            "volume_delta": round(q_sim - q_base, 0),
            "cac_delta": round(cac_sim - baseline["baseline_cac"], 2)
        },
        "waterfall": waterfall,
        "sensitivity": {
            "price_curve": sensitivity_price_curve,
            "spend_curve": sensitivity_spend_curve
        },
        "recommendation": _generate_simulator_recommendation(rev_delta_pct, profit_delta_pct, ltv_cac_sim)
    }


def _generate_simulator_recommendation(rev_delta_pct: float, profit_delta_pct: float, ltv_cac: float) -> Dict[str, str]:
    if profit_delta_pct > 15 and ltv_cac >= 3.0:
        return {
            "verdict": "High-Conviction Growth Strategy",
            "tone": "emerald",
            "summary": "This scenario drives substantial bottom-line expansion while maintaining healthy capital efficiency. Recommend piloting across Tier-2 segments."
        }
    elif rev_delta_pct > 10 and profit_delta_pct < -5:
        return {
            "verdict": "Revenue Growth at Margin Sacrifice",
            "tone": "amber",
            "summary": "Aggressive acquisition or discount levers inflate top-line volume at the expense of EBITDA. Consider coupling with retention optimization to restore margins."
        }
    elif profit_delta_pct > 10 and rev_delta_pct < 0:
        return {
            "verdict": "Margin Optimization / Value Realization",
            "tone": "teal",
            "summary": "Price premiumization comfortably offsets elasticity drop, maximizing free cash flow. Ensure customer support and SLA guarantees remain pristine."
        }
    else:
        return {
            "verdict": "Balanced Scenario",
            "tone": "blue",
            "summary": "Scenario operates within standard volatility bounds. Recommend small-cohort A/B testing before organization-wide rollout."
        }
