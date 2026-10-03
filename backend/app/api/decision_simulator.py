import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.auth_middleware import get_current_user, get_optional_user
from ..db.models import User, WhatIfScenario
from ..db.session import get_db
from ..deps import get_bundle
from ..services.decision_simulator import (
    extract_baseline_business_metrics,
    simulate_business_scenario,
)

router = APIRouter(tags=["What-If Decision Simulator"])


class SimulationRequest(BaseModel):
    price_change_pct: float = Field(0.0, description="Percentage change in price (-50% to +100%)")
    marketing_spend_pct: float = Field(0.0, description="Percentage change in marketing spend (-80% to +200%)")
    churn_reduction_pct: float = Field(0.0, description="Percentage improvement in churn rate (0% to 80%)")
    conversion_rate_pct: float = Field(0.0, description="Percentage uplift in conversion rate (-50% to +100%)")
    elasticity_model: str = Field("moderate", description="inelastic, moderate, elastic")


class SaveScenarioRequest(BaseModel):
    name: str
    description: Optional[str] = None
    dataset_id: Optional[str] = "demo-sales"
    price_change_pct: float
    marketing_spend_pct: float
    churn_reduction_pct: float
    conversion_rate_pct: float
    elasticity_model: str = "moderate"
    baseline_metrics: Dict[str, Any]
    projected_metrics: Dict[str, Any]
    variance_summary: Dict[str, Any]


@router.get("/api/datasets/{dataset_id}/decision-simulator/baseline")
def get_simulator_baseline(
    dataset_id: str,
    current_user: Optional[User] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """
    Extracts baseline business metrics from the dataset for decision simulation.
    """
    try:
        bundle = get_bundle(dataset_id)
        df = bundle["frame"]
        baseline = extract_baseline_business_metrics(df)
        return {
            "dataset_id": dataset_id,
            "filename": bundle["filename"],
            "baseline": baseline
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract simulator baseline: {str(e)}")


@router.post("/api/datasets/{dataset_id}/decision-simulator/simulate")
def run_simulation(
    dataset_id: str,
    req: SimulationRequest,
    current_user: Optional[User] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """
    Runs econometric simulation and returns projections, waterfall breakdown, and sensitivity sweeps.
    """
    try:
        bundle = get_bundle(dataset_id)
        df = bundle["frame"]
        baseline = extract_baseline_business_metrics(df)
        results = simulate_business_scenario(
            baseline=baseline,
            price_change_pct=req.price_change_pct,
            marketing_spend_pct=req.marketing_spend_pct,
            churn_reduction_pct=req.churn_reduction_pct,
            conversion_rate_pct=req.conversion_rate_pct,
            elasticity_model=req.elasticity_model
        )
        results["dataset_id"] = dataset_id
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


@router.get("/api/decision-simulator/scenarios")
def list_saved_scenarios(
    workspace_id: str = Query("default-workspace"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Lists saved What-If scenarios for the workspace.
    """
    scenarios = db.query(WhatIfScenario).filter(
        WhatIfScenario.workspace_id == workspace_id
    ).order_by(WhatIfScenario.created_at.desc()).all()

    # If none yet, provide standard curated strategic archetypes
    if not scenarios:
        archetypes = [
            {
                "id": "arch-price-premium",
                "name": "Value Realization (+15% Price)",
                "description": "Premium tier repositioning testing price inelasticity with enterprise buyers.",
                "price_change_pct": 15.0,
                "marketing_spend_pct": 0.0,
                "churn_reduction_pct": 0.0,
                "conversion_rate_pct": 0.0,
                "elasticity_model": "moderate",
                "created_at": "2026-10-01T10:00:00Z"
            },
            {
                "id": "arch-growth-surge",
                "name": "Aggressive Market Share (+40% Ad Spend)",
                "description": "Ramping paid digital acquisition to capture peak seasonal demand.",
                "price_change_pct": -5.0,
                "marketing_spend_pct": 40.0,
                "churn_reduction_pct": 10.0,
                "conversion_rate_pct": 15.0,
                "elasticity_model": "moderate",
                "created_at": "2026-10-02T14:30:00Z"
            },
            {
                "id": "arch-retention-focus",
                "name": "Churn Reduction & Expansion",
                "description": "Investing in customer success to suppress churn by 35% and expand LTV:CAC.",
                "price_change_pct": 5.0,
                "marketing_spend_pct": -10.0,
                "churn_reduction_pct": 35.0,
                "conversion_rate_pct": 5.0,
                "elasticity_model": "inelastic",
                "created_at": "2026-10-03T09:15:00Z"
            }
        ]
        return archetypes

    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "dataset_id": s.dataset_id,
            "price_change_pct": s.price_change_pct,
            "marketing_spend_pct": s.marketing_spend_pct,
            "churn_reduction_pct": s.churn_reduction_pct,
            "conversion_rate_pct": s.conversion_rate_pct,
            "elasticity_model": s.elasticity_model,
            "baseline_metrics": json.loads(s.baseline_metrics_json or "{}"),
            "projected_metrics": json.loads(s.projected_metrics_json or "{}"),
            "variance_summary": json.loads(s.variance_summary_json or "{}"),
            "created_at": s.created_at.isoformat() if hasattr(s.created_at, "isoformat") else str(s.created_at)
        }
        for s in scenarios
    ]


@router.post("/api/decision-simulator/scenarios")
def save_scenario(
    req: SaveScenarioRequest,
    workspace_id: str = Query("default-workspace"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Saves a simulation scenario for team collaboration and executive presentations.
    """
    user_id = current_user.id if current_user else "default-user"
    scenario = WhatIfScenario(
        workspace_id=workspace_id,
        user_id=user_id,
        dataset_id=req.dataset_id,
        name=req.name,
        description=req.description,
        price_change_pct=req.price_change_pct,
        marketing_spend_pct=req.marketing_spend_pct,
        churn_reduction_pct=req.churn_reduction_pct,
        conversion_rate_pct=req.conversion_rate_pct,
        elasticity_model=req.elasticity_model,
        baseline_metrics_json=json.dumps(req.baseline_metrics, ensure_ascii=True),
        projected_metrics_json=json.dumps(req.projected_metrics, ensure_ascii=True),
        variance_summary_json=json.dumps(req.variance_summary, ensure_ascii=True)
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)

    return {
        "id": scenario.id,
        "name": scenario.name,
        "status": "saved",
        "created_at": scenario.created_at.isoformat()
    }


@router.delete("/api/decision-simulator/scenarios/{scenario_id}")
def delete_scenario(
    scenario_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Deletes a saved scenario.
    """
    rec = db.query(WhatIfScenario).filter(WhatIfScenario.id == scenario_id).first()
    if rec:
        db.delete(rec)
        db.commit()
    return {"id": scenario_id, "status": "deleted"}
