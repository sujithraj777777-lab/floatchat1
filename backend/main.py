from fastapi import FastAPI, HTTPException, Query, Response, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from ocean_data import read_profile, profile_is_ready, read_history, read_catalog, read_catalog_profiles
from pydantic import BaseModel, Field
from query_engine import OceanQuery, execute_query
from ocean_llm import AskRequest, ask_ocean
import io
import csv
import json

app = FastAPI(
    title="FloatChat API",
    description="Backend for ocean data exploration and AI analytics.",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()


@app.get("/")
def root():
    return {"message": "Welcome to FloatChat", "docs": "/docs", "version": "0.3.0"}


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "FloatChat API",
        "data_ready": profile_is_ready(),
        "version": "0.3.0",
    }


@router.get("/catalog")
def catalog():
    return read_catalog()


@router.get("/profiles/demo")
def demo_profile():
    try:
        return read_profile()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except OSError as error:
        raise HTTPException(status_code=500, detail="Profile file could not be read.") from error


@router.get("/profiles/history")
def profile_history(float_id: int | None = Query(default=None, gt=0)):
    if float_id is None:
        return read_history()
    history = read_catalog_profiles(float_id=float_id)
    return {
        "profiles": history["profiles"],
        "excluded_profiles": history["excluded_profiles"],
        "available_profiles": len(history["profiles"]),
        "discovered_files": history["discovered_files"],
        "float_id": float_id,
    }


class FetchArgoRequest(BaseModel):
    float_id: int = Field(gt=0)
    cycles: list[int] = Field(default_factory=lambda: [30, 31, 32, 33, 34])


@router.post("/fetch/argo")
def fetch_argo(request: FetchArgoRequest):
    """Dynamically download Argo profiles from ERDDAP by float ID and cycles."""
    from argo_fetcher import fetch_argo_series
    try:
        return fetch_argo_series(request.float_id, request.cycles)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err)) from err


@router.get("/export/csv")
def export_csv(float_id: int = Query(gt=0), cycle: int = Query(ge=0)):
    """Export profile observations to CSV format."""
    from tools import get_profile
    profile = get_profile(float_id, cycle)
    if "error" in profile or not profile.get("observations"):
        raise HTTPException(status_code=404, detail=profile.get("error", "Profile not found"))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "float_id", "cycle", "time_utc", "latitude", "longitude",
        "pressure_dbar", "depth_m", "temperature_c", "salinity_psu"
    ])

    for obs in profile["observations"]:
        writer.writerow([
            profile["float_id"],
            profile["cycle"],
            profile["time_utc"],
            profile["latitude"],
            profile["longitude"],
            obs["pressure_dbar"],
            obs["depth_m"],
            obs["temperature_c"],
            obs["salinity_psu"],
        ])

    csv_data = output.getvalue()
    filename = f"argo_{float_id}_cycle_{cycle}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/geojson")
def export_geojson(float_id: int | None = Query(default=None)):
    """Export profile spatial locations as a GeoJSON FeatureCollection."""
    history = read_catalog_profiles(float_id=float_id)
    features = []

    for p in history["profiles"]:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [p["longitude"], p["latitude"]],
            },
            "properties": {
                "float_id": p["float_id"],
                "cycle": p["cycle"],
                "time_utc": p["time_utc"],
                "accepted_levels": p["accepted_levels"],
                "surface_temp_c": p["observations"][0]["temperature_c"] if p["observations"] else None,
                "surface_sal_psu": p["observations"][0]["salinity_psu"] if p["observations"] else None,
            },
        })

    geojson_data = {
        "type": "FeatureCollection",
        "features": features,
    }

    return Response(
        content=json.dumps(geojson_data, indent=2),
        media_type="application/geo+json",
        headers={"Content-Disposition": f"attachment; filename=floatchat_{float_id or 'all'}.geojson"},
    )


@router.post("/query")
def query_endpoint(query: OceanQuery):
    """Execute depth and coordinate filtering on ocean profiles."""
    return execute_query(query)


@router.post("/ask")
def ask(request: AskRequest):
    return ask_ocean(request)


@router.get("/tools")
def list_tools():
    from tools import get_available_tools
    return {"tools": get_available_tools()}


class ToolExecuteRequest(BaseModel):
    tool: str
    arguments: dict = {}


@router.post("/tools/execute")
def execute_tool_endpoint(request: ToolExecuteRequest):
    from tools import execute_tool
    return execute_tool(request.tool, request.arguments)


@router.get("/forecast/{float_id}")
def forecast(
    float_id: int,
    variable: str = Query(default="temperature", pattern="^(temperature|salinity)$"),
    horizon_days: int = Query(default=30, ge=1, le=90),
):
    from services.ocean_analytics import OceanAnalyticsService

    history = read_catalog_profiles(float_id=float_id)
    if not history["profiles"]:
        raise HTTPException(status_code=404, detail=f"No profiles found for float {float_id}")

    observations = []
    for p in history["profiles"]:
        observations.append({
            "time_utc": p["time_utc"],
            "temperature_c": p["observations"][0]["temperature_c"] if p["observations"] else None,
            "salinity_psu": p["observations"][0]["salinity_psu"] if p["observations"] else None,
        })

    service = OceanAnalyticsService()

    if variable == "temperature":
        result = service.forecast_temperature(observations, horizon_days)
    else:
        result = service.forecast_salinity(observations, horizon_days)

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return {
        "float_id": float_id,
        "variable": variable,
        "unit": "°C" if variable == "temperature" else "PSU",
        "disclaimer": (
            "This is a statistical extrapolation based on observed data trends. "
            "It is NOT a physical ocean model prediction. "
            "Confidence intervals widen with forecast horizon. "
            "Do not use for operational decision-making."
        ),
        "evidence": {
            "method": "Polynomial trend extrapolation with noise estimation",
            "source_profiles": len(history["profiles"]),
            "cycle_range": [history["profiles"][0]["cycle"], history["profiles"][-1]["cycle"]],
        },
        **result,
    }


class SoundSpeedRequest(BaseModel):
    float_id: int
    cycle: int


@router.post("/analyze/sound-speed")
def analyze_sound_speed(request: SoundSpeedRequest):
    """Calculate underwater sound speed profile and SOFAR acoustic axis depth."""
    from services.ocean_analytics import OceanAnalyticsService
    from tools import get_profile

    profile = get_profile(request.float_id, request.cycle)
    if "error" in profile or not profile.get("observations"):
        raise HTTPException(status_code=404, detail=profile.get("error", "No observations"))

    service = OceanAnalyticsService()
    result = service.calculate_sound_speed(profile["observations"])
    result["float_id"] = request.float_id
    result["cycle"] = request.cycle
    return result


class ThermoclineRequest(BaseModel):
    float_id: int
    cycle: int
    min_gradient: float = 0.02


@router.post("/analyze/thermocline")
def analyze_thermocline(request: ThermoclineRequest):
    from services.ocean_analytics import OceanAnalyticsService
    from tools import get_profile

    profile = get_profile(request.float_id, request.cycle)
    if "error" in profile or not profile.get("observations"):
        raise HTTPException(status_code=404, detail=profile.get("error", "No observations"))

    service = OceanAnalyticsService()
    result = service.detect_thermocline(profile["observations"], request.min_gradient)
    result["float_id"] = request.float_id
    result["cycle"] = request.cycle
    result["evidence"] = {
        "file": profile.get("evidence", {}).get("local_dataset"),
        "observation_count": len(profile["observations"]),
    }
    return result


class MixedLayerRequest(BaseModel):
    float_id: int
    cycle: int
    threshold_c: float = 0.2


@router.post("/analyze/mixed-layer")
def analyze_mixed_layer(request: MixedLayerRequest):
    from services.ocean_analytics import OceanAnalyticsService
    from tools import get_profile

    profile = get_profile(request.float_id, request.cycle)
    if "error" in profile or not profile.get("observations"):
        raise HTTPException(status_code=404, detail=profile.get("error", "No observations"))

    service = OceanAnalyticsService()
    result = service.detect_mixed_layer(profile["observations"], request.threshold_c)
    result["float_id"] = request.float_id
    result["cycle"] = request.cycle
    result["evidence"] = {
        "file": profile.get("evidence", {}).get("local_dataset"),
        "observation_count": len(profile["observations"]),
    }
    return result


class DepthChangeRequest(BaseModel):
    float_id: int
    cycle_a: int
    cycle_b: int


@router.post("/analyze/depth-changes")
def analyze_depth_changes(request: DepthChangeRequest):
    from services.ocean_analytics import OceanAnalyticsService
    from tools import get_profile

    profile_a = get_profile(request.float_id, request.cycle_a)
    profile_b = get_profile(request.float_id, request.cycle_b)

    if "error" in profile_a or not profile_a.get("observations"):
        raise HTTPException(status_code=404, detail=profile_a.get("error", "No observations for cycle A"))
    if "error" in profile_b or not profile_b.get("observations"):
        raise HTTPException(status_code=404, detail=profile_b.get("error", "No observations for cycle B"))

    service = OceanAnalyticsService()
    result = service.calculate_depth_change_profile(profile_a, profile_b)
    result["float_id"] = request.float_id
    result["cycle_a"] = request.cycle_a
    result["cycle_b"] = request.cycle_b
    result["time_a"] = profile_a.get("time_utc")
    result["time_b"] = profile_b.get("time_utc")
    result["evidence"] = {
        "file_a": profile_a.get("evidence", {}).get("local_dataset"),
        "file_b": profile_b.get("evidence", {}).get("local_dataset"),
        "method": "Matched by nearest pressure within 50 dbar. No interpolation.",
    }
    return result


class SofarRequest(BaseModel):
    float_id: int
    cycle: int


@router.post("/analyze/sofar-channel")
def analyze_sofar_channel(request: SofarRequest):
    from services.ocean_analytics import OceanAnalyticsService
    from tools import get_profile

    profile = get_profile(request.float_id, request.cycle)
    if "error" in profile or not profile.get("observations"):
        raise HTTPException(status_code=404, detail=profile.get("error", "No observations"))

    service = OceanAnalyticsService()
    result = service.calculate_sofar_ray_trace(profile["observations"])
    result["float_id"] = request.float_id
    result["cycle"] = request.cycle
    return result


@router.get("/analyze/distance-matrix")
def analyze_distance_matrix(float_id: int = Query(gt=0)):
    from services.ocean_analytics import OceanAnalyticsService
    history = read_catalog_profiles(float_id=float_id)
    if not history.get("profiles"):
        raise HTTPException(status_code=404, detail="Float profile history not found")

    service = OceanAnalyticsService()
    return service.calculate_geodesic_distance_matrix(history["profiles"])


@router.get("/profiles/metadata")
def profile_metadata(float_id: int = Query(gt=0), cycle: int = Query(ge=0)):
    from tools import get_profile
    profile = get_profile(float_id, cycle)
    if "error" in profile:
        raise HTTPException(status_code=404, detail=profile.get("error", "Profile not found"))

    return {
        "float_id": float_id,
        "cycle": cycle,
        "global_attributes": {
            "title": f"ARGO Float WMO {float_id} Cycle {cycle} Profile",
            "institution": "Coriolis Data Assembly Center (IFREMER)",
            "source": "ARGO Autonomous Ocean Profiler CTD",
            "Conventions": "CF-1.6, Argo-3.1",
            "platform_number": str(float_id),
            "cycle_number": str(cycle),
            "date_creation": profile.get("time_utc"),
            "data_mode": profile.get("data_mode", "D"),
            "qc_policy": profile.get("evidence", {}).get("qc_policy", "Argo Quality Control Manual v3.1"),
        },
        "dimensions": {
            "N_PROF": 1,
            "N_LEVELS": profile.get("total_levels", len(profile.get("observations", []))),
            "N_PARAM": 3,
        },
        "variables": {
            "PRES": {"standard_name": "sea_water_pressure", "units": "dbar", "valid_min": 0.0, "valid_max": 2000.0},
            "TEMP": {"standard_name": "sea_water_temperature", "units": "degree_Celsius", "valid_min": -2.5, "valid_max": 40.0},
            "PSAL": {"standard_name": "sea_water_salinity", "units": "1", "valid_min": 2.0, "valid_max": 41.0},
        },
        "evidence": profile.get("evidence", {}),
    }

# Register all routes under both root (/) and (/api) prefixes
app.include_router(router)
app.include_router(router, prefix="/api")
