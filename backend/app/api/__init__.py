from .upload import router as upload_router
from .profile import router as profile_router
from .analysis import router as analysis_router
from .visualization import router as visualization_router
from .forecast import router as forecast_router
from .anomalies import router as anomalies_router
from .insights import router as insights_router
from .reports import router as reports_router

__all__ = [
    "upload_router",
    "profile_router",
    "analysis_router",
    "visualization_router",
    "forecast_router",
    "anomalies_router",
    "insights_router",
    "reports_router",
]
