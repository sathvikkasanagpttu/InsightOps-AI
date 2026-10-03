from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.auth_middleware import get_optional_user
from ..db.models import User
from ..db.session import get_db
from ..deps import get_bundle
from ..services.advanced_analytics import (
    compute_cohort_retention,
    compute_clv_and_churn,
    compute_rfm_segmentation,
    compute_unit_economics_and_roi,
    generate_full_advanced_analytics,
    _detect_analytics_columns,
)

router = APIRouter(tags=["Advanced Analytics & Unit Economics"])


@router.get("/api/datasets/{dataset_id}/advanced-analytics")
def get_advanced_analytics(
    dataset_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Computes comprehensive business intelligence: RFM segmentation,
    cohort retention matrix, customer lifetime value (CLV), churn risk scoring,
    and unit economics (CAC, ROAS, LTV:CAC).
    """
    try:
        bundle = get_bundle(dataset_id)
        df = bundle["frame"]
        return generate_full_advanced_analytics(df, dataset_id=dataset_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute advanced analytics: {str(e)}")


@router.get("/api/datasets/{dataset_id}/rfm")
def get_rfm_segmentation(
    dataset_id: str,
    current_user: Optional[User] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """
    Returns RFM quintile scores and customer persona segment breakdown.
    """
    try:
        bundle = get_bundle(dataset_id)
        df = bundle["frame"]
        detected = _detect_analytics_columns(df)
        return compute_rfm_segmentation(df, detected)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute RFM segmentation: {str(e)}")


@router.get("/api/datasets/{dataset_id}/cohorts")
def get_cohort_retention(
    dataset_id: str,
    current_user: Optional[User] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """
    Returns acquisition cohort matrix and retention decay curves.
    """
    try:
        bundle = get_bundle(dataset_id)
        df = bundle["frame"]
        detected = _detect_analytics_columns(df)
        return compute_cohort_retention(df, detected)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute cohort retention: {str(e)}")


@router.get("/api/datasets/{dataset_id}/clv-churn")
def get_clv_and_churn(
    dataset_id: str,
    current_user: Optional[User] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """
    Returns CLV distribution, whale customer concentration, and churn probability risk tiers.
    """
    try:
        bundle = get_bundle(dataset_id)
        df = bundle["frame"]
        detected = _detect_analytics_columns(df)
        return compute_clv_and_churn(df, detected)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute CLV & churn: {str(e)}")


@router.get("/api/datasets/{dataset_id}/unit-economics")
def get_unit_economics(
    dataset_id: str,
    current_user: Optional[User] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """
    Returns Unit Economics: CAC, LTV:CAC, ROAS, payback period, and capital efficiency score.
    """
    try:
        bundle = get_bundle(dataset_id)
        df = bundle["frame"]
        detected = _detect_analytics_columns(df)
        return compute_unit_economics_and_roi(df, detected)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute unit economics: {str(e)}")
