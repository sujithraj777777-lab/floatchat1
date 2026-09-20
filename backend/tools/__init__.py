from tools.search_floats import search_floats
from tools.get_float_metadata import get_float_metadata
from tools.get_profile import get_profile
from tools.get_profile_history import get_profile_history
from tools.compare_profiles import compare_profiles
from tools.get_depth_slice import get_depth_slice
from tools.calculate_statistics import calculate_statistics
from tools.explain_qc_flags import explain_qc_flags
from tools.detect_anomalies import detect_anomalies
from tools.get_evidence import get_evidence
from tools.calculate_temperature_change import calculate_temperature_change
from tools.calculate_salinity_change import calculate_salinity_change

TOOL_REGISTRY: dict[str, callable] = {
    "search_floats": search_floats,
    "get_float_metadata": get_float_metadata,
    "get_profile": get_profile,
    "get_profile_history": get_profile_history,
    "compare_profiles": compare_profiles,
    "get_depth_slice": get_depth_slice,
    "calculate_statistics": calculate_statistics,
    "explain_qc_flags": explain_qc_flags,
    "detect_anomalies": detect_anomalies,
    "get_evidence": get_evidence,
    "calculate_temperature_change": calculate_temperature_change,
    "calculate_salinity_change": calculate_salinity_change,
}

TOOL_DESCRIPTIONS = {
    "search_floats": {
        "description": "Search available ARGO floats in the local catalogue",
        "parameters": {
            "float_id": {"type": "integer", "description": "Filter by specific float ID (optional)"},
        },
    },
    "get_float_metadata": {
        "description": "Get metadata for a specific ARGO float cycle",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "cycle": {"type": "integer", "required": True},
        },
    },
    "get_profile": {
        "description": "Get a single profile with all observations",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "cycle": {"type": "integer", "required": True},
        },
    },
    "get_profile_history": {
        "description": "Get historical profiles for a float",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "cycle_start": {"type": "integer", "description": "Start cycle (optional)"},
            "cycle_end": {"type": "integer", "description": "End cycle (optional)"},
        },
    },
    "compare_profiles": {
        "description": "Compare two profiles and calculate deltas",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "cycle_a": {"type": "integer", "required": True},
            "cycle_b": {"type": "integer", "required": True},
            "variable": {"type": "string", "enum": ["temperature", "salinity"], "default": "temperature"},
            "min_pressure": {"type": "number", "description": "Minimum pressure filter in dbar (optional)"},
            "max_pressure": {"type": "number", "description": "Maximum pressure filter in dbar (optional)"},
        },
    },
    "get_depth_slice": {
        "description": "Get observations near a specific depth across cycles",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "target_depth_m": {"type": "number", "required": True},
            "tolerance_m": {"type": "number", "default": 25.0},
            "cycle_start": {"type": "integer", "description": "Start cycle (optional)"},
            "cycle_end": {"type": "integer", "description": "End cycle (optional)"},
        },
    },
    "calculate_statistics": {
        "description": "Calculate statistical summary for a variable",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "cycle": {"type": "integer", "required": True},
            "variable": {"type": "string", "enum": ["temperature", "salinity"], "required": True},
            "min_pressure": {"type": "number", "description": "Minimum pressure filter (optional)"},
            "max_pressure": {"type": "number", "description": "Maximum pressure filter (optional)"},
        },
    },
    "explain_qc_flags": {
        "description": "Explain ARGO QC flag values",
        "parameters": {
            "flag_value": {"type": "string", "description": "QC flag value to explain (1-9, A, B, etc.)"},
        },
    },
    "detect_anomalies": {
        "description": "Detect unusual changes in temperature or salinity profiles using statistical methods",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "cycle": {"type": "integer", "required": True},
            "variable": {"type": "string", "enum": ["temperature", "salinity"], "required": True},
            "method": {"type": "string", "enum": ["zscore", "iqr"], "default": "zscore"},
            "threshold": {"type": "number", "description": "Z-score threshold (default 2.0) or IQR multiplier (default 1.5)"},
        },
    },
    "get_evidence": {
        "description": "Get full evidence package for a specific observation",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "cycle": {"type": "integer", "required": True},
            "source_row": {"type": "integer", "description": "Source row index (optional, returns all)"},
        },
    },
    "calculate_temperature_change": {
        "description": "Calculate temperature change between two cycles at a specific depth range",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "cycle_a": {"type": "integer", "required": True},
            "cycle_b": {"type": "integer", "required": True},
            "min_pressure": {"type": "number", "description": "Minimum pressure in dbar (optional)"},
            "max_pressure": {"type": "number", "description": "Maximum pressure in dbar (optional)"},
        },
    },
    "calculate_salinity_change": {
        "description": "Calculate salinity change between two cycles at a specific depth range",
        "parameters": {
            "float_id": {"type": "integer", "required": True},
            "cycle_a": {"type": "integer", "required": True},
            "cycle_b": {"type": "integer", "required": True},
            "min_pressure": {"type": "number", "description": "Minimum pressure in dbar (optional)"},
            "max_pressure": {"type": "number", "description": "Maximum pressure in dbar (optional)"},
        },
    },
}


def get_available_tools() -> list[dict]:
    """Return list of available tools with descriptions."""
    return [
        {"name": name, **description}
        for name, description in TOOL_DESCRIPTIONS.items()
    ]


def execute_tool(tool_name: str, arguments: dict) -> dict:
    """Execute a tool by name with arguments."""
    if tool_name not in TOOL_REGISTRY:
        return {
            "tool": tool_name,
            "status": "error",
            "error": f"Unknown tool: {tool_name}. Available: {list(TOOL_REGISTRY.keys())}",
        }

    try:
        tool_fn = TOOL_REGISTRY[tool_name]
        result = tool_fn(**arguments)
        return {
            "tool": tool_name,
            "status": "success",
            "result": result,
        }
    except TypeError as e:
        return {
            "tool": tool_name,
            "status": "error",
            "error": f"Invalid arguments for {tool_name}: {e}",
        }
    except Exception as e:
        return {
            "tool": tool_name,
            "status": "error",
            "error": f"Tool {tool_name} failed: {e}",
        }
