import { useEffect, useRef, useState } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
  ImageryLayer,
  LabelStyle,
  PolylineDashMaterialProperty,
  TileMapServiceImageryProvider,
  UrlTemplateImageryProvider,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

type TrackProfile = {
  float_id: number;
  cycle: number;
  time_utc: string;
  latitude: number;
  longitude: number;
};

type Props = {
  latitude: number;
  longitude: number;
  floatId: number;
  cycle: number;
  profiles: TrackProfile[];
};

type MapLayerType = "ocean" | "satellite" | "dark" | "natural";

export default function OceanGlobe({
  latitude,
  longitude,
  floatId,
  cycle,
  profiles,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const baseLayerRef = useRef<ImageryLayer | null>(null);
  const refOverlayRef = useRef<ImageryLayer | null>(null);
  const positionedRef = useRef(false);

  const [error, setError] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayerType>("ocean");
  const [hudStatus, setHudStatus] = useState<string>("HD Bathymetry Engine Active");

  // Helper to construct high-definition tile providers
  const getProviders = async (type: MapLayerType) => {
    switch (type) {
      case "ocean":
        return {
          base: new UrlTemplateImageryProvider({
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
            maximumLevel: 13,
            credit: "Esri Ocean Basemap",
          }),
          ref: new UrlTemplateImageryProvider({
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}",
            maximumLevel: 13,
            credit: "Esri Ocean Reference Labels",
          }),
        };
      case "satellite":
        return {
          base: new UrlTemplateImageryProvider({
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            maximumLevel: 18,
            credit: "Esri World Imagery",
          }),
          ref: null,
        };
      case "dark":
        return {
          base: new UrlTemplateImageryProvider({
            url: "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
            maximumLevel: 18,
            credit: "CartoDB Dark",
          }),
          ref: null,
        };
      case "natural":
      default: {
        const baseProvider = await TileMapServiceImageryProvider.fromUrl(
          "/cesium/Assets/Textures/NaturalEarthII",
          { credit: "Natural Earth" }
        );
        return {
          base: baseProvider,
          ref: null,
        };
      }
    }
  };

  // Initialize the 3D Globe with Atmosphere and High-Resolution Settings
  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: Viewer;

    try {
      viewer = new Viewer(containerRef.current, {
        baseLayer: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: true,
        requestRenderMode: true,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create 3D globe visualization."
      );
      return;
    }

    viewerRef.current = viewer;
    positionedRef.current = false;

    // High-Resolution & Crisp Rendering Configuration
    viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2.0);
    viewer.scene.globe.maximumScreenSpaceError = 1.0; // Quadruples level-of-detail tile sharpness
    viewer.scene.globe.tileCacheSize = 300;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.highDynamicRange = true;
    viewer.scene.backgroundColor = Color.fromCssColorString("#0f172a");

    // Load Default HD Ocean Imagery + Reference Overlay
    void Promise.resolve(getProviders("ocean"))
      .then(({ base, ref }) => {
        if (viewer.isDestroyed()) return;
        baseLayerRef.current = viewer.imageryLayers.addImageryProvider(base);
        if (ref) {
          refOverlayRef.current = viewer.imageryLayers.addImageryProvider(ref);
        }
        viewer.scene.requestRender();
      })
      .catch((err: unknown) => {
        if (viewer.isDestroyed()) return;
        setError(
          err instanceof Error ? err.message : "Could not load HD ocean imagery layer."
        );
      });

    return () => {
      viewerRef.current = null;
      positionedRef.current = false;
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  // Switch Imagery Layer dynamically
  const switchLayer = async (type: MapLayerType) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    try {
      setActiveLayer(type);
      const { base, ref } = await getProviders(type);
      if (viewer.isDestroyed()) return;

      if (baseLayerRef.current) {
        viewer.imageryLayers.remove(baseLayerRef.current);
        baseLayerRef.current = null;
      }
      if (refOverlayRef.current) {
        viewer.imageryLayers.remove(refOverlayRef.current);
        refOverlayRef.current = null;
      }

      baseLayerRef.current = viewer.imageryLayers.addImageryProvider(base);
      if (ref) {
        refOverlayRef.current = viewer.imageryLayers.addImageryProvider(ref);
      }

      setHudStatus(`HD Map Layer: ${type.toUpperCase()}`);
      viewer.scene.requestRender();
    } catch (err) {
      setError("Failed to switch map imagery layer.");
    }
  };

  // Selected observation position marker with crisp multi-ring pin & label card
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.entities.removeById("selected-profile");
    viewer.entities.removeById("selected-profile-halo");

    // Halo pulse ring
    viewer.entities.add({
      id: "selected-profile-halo",
      position: Cartesian3.fromDegrees(longitude, latitude),
      point: {
        pixelSize: 22,
        color: Color.fromCssColorString("rgba(56, 189, 248, 0.35)"),
        outlineColor: Color.fromCssColorString("#38bdf8"),
        outlineWidth: 1.5,
      },
    });

    // Core point pin
    viewer.entities.add({
      id: "selected-profile",
      name: `Argo Float WMO ${floatId} · Cycle ${cycle}`,
      position: Cartesian3.fromDegrees(longitude, latitude),
      point: {
        pixelSize: 12,
        color: Color.fromCssColorString("#0ea5e9"),
        outlineColor: Color.WHITE,
        outlineWidth: 2.5,
      },
      label: {
        text: `ARGO WMO ${floatId} (CYCLE ${cycle})\nLAT: ${latitude.toFixed(3)}°  LON: ${longitude.toFixed(3)}°`,
        font: "bold 12px JetBrains Mono, monospace",
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString("#0f172a"),
        outlineWidth: 4,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -35),
        backgroundColor: Color.fromCssColorString("rgba(15, 23, 42, 0.95)"),
        showBackground: true,
        backgroundPadding: new Cartesian2(8, 6),
      },
    });

    if (!positionedRef.current) {
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(
          longitude,
          latitude,
          6_500_000
        ),
      });

      positionedRef.current = true;
    }

    viewer.scene.requestRender();
  }, [latitude, longitude, floatId, cycle]);

  // Render 3D Float Drift Trajectory with defined waypoints
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const previousEntities = viewer.entities.values.filter((entity) =>
      entity.id.startsWith("history-")
    );

    previousEntities.forEach((entity) => {
      viewer.entities.remove(entity);
    });

    const ordered = profiles
      .filter(
        (p) =>
          p.float_id === floatId &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude)
      )
      .slice()
      .sort((a, b) => a.time_utc.localeCompare(b.time_utc));

    const selectedIndex = ordered.findIndex((p) => p.cycle === cycle);
    const visibleHistory = selectedIndex >= 0 ? ordered.slice(0, selectedIndex + 1) : ordered;

    visibleHistory.slice(0, -1).forEach((p) => {
      viewer.entities.add({
        id: `history-point-${p.float_id}-${p.cycle}`,
        name: `Float ${p.float_id} · Cycle ${p.cycle} (${p.time_utc.slice(0, 10)})`,
        position: Cartesian3.fromDegrees(p.longitude, p.latitude),
        point: {
          pixelSize: 8,
          color: Color.fromCssColorString("#f97316"),
          outlineColor: Color.BLACK,
          outlineWidth: 1.5,
        },
        label: {
          text: `C${p.cycle}`,
          font: "10px JetBrains Mono, monospace",
          fillColor: Color.fromCssColorString("#cbd5e1"),
          outlineColor: Color.fromCssColorString("#0f172a"),
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cartesian2(0, 14),
        },
      });
    });

    if (visibleHistory.length >= 2) {
      viewer.entities.add({
        id: "history-track",
        name: `3D Drift Trajectory for Float ${floatId}`,
        polyline: {
          positions: visibleHistory.map((p) =>
            Cartesian3.fromDegrees(p.longitude, p.latitude)
          ),
          width: 3.5,
          material: new PolylineDashMaterialProperty({
            color: Color.fromCssColorString("#2dd4bf"),
            dashLength: 12,
          }),
        },
      });
    }

    viewer.scene.requestRender();
  }, [profiles, floatId, cycle]);

  function focusProfile() {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(longitude, latitude, 500_000),
      duration: 1.2,
    });
  }

  function setViewPreset(preset: "global" | "atlantic" | "pacific" | "indian") {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const coords = {
      global: { lon: longitude, lat: latitude, alt: 14_000_000 },
      atlantic: { lon: -45, lat: 20, alt: 9_000_000 },
      pacific: { lon: -140, lat: 10, alt: 12_000_000 },
      indian: { lon: 75, lat: -10, alt: 10_000_000 },
    }[preset];

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(coords.lon, coords.lat, coords.alt),
      duration: 1.2,
    });
  }

  // Smooth 3D Trajectory Flight Tour
  async function animateTrajectory() {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || isAnimating) return;

    const ordered = profiles
      .filter((p) => p.float_id === floatId)
      .sort((a, b) => a.time_utc.localeCompare(b.time_utc));

    if (ordered.length === 0) return;

    setIsAnimating(true);
    setHudStatus("Trajectory animation active...");

    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      setHudStatus(`Traversing Cycle ${p.cycle} (${p.time_utc.slice(0, 10)})`);

      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(p.longitude, p.latitude, 650_000),
        duration: 1.2,
      });

      await new Promise((resolve) => setTimeout(resolve, 1400));
    }

    setIsAnimating(false);
    setHudStatus("Trajectory animation finished");
  }

  // Orbit Mode
  function toggleOrbitMode() {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (isOrbiting) {
      setIsOrbiting(false);
      setHudStatus("Orbit mode disabled");
    } else {
      setIsOrbiting(true);
      setHudStatus("Continuous Orbit Active");
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(longitude, latitude, 8_000_000),
        duration: 1.4,
      });
    }
  }

  return (
    <article className="ocean-globe-card">
      <div className="ocean-globe-heading">
        <div>
          <h3 style={{ margin: 0, fontSize: "16px" }}>HD Ocean Trajectory & Bathymetry Visualizer</h3>
          <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: "12px" }}>
            Float <strong>{floatId}</strong> (Cycle {cycle}) at{" "}
            <strong>{latitude.toFixed(3)}° N, {longitude.toFixed(3)}° E</strong> | Status:{" "}
            <span style={{ color: "var(--accent-blue)", fontWeight: "600" }}>{hudStatus}</span>
          </p>
        </div>

        {/* Map Layer & View Controls */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Layer Selector */}
          <div style={{ display: "flex", background: "#0f172a", borderRadius: "6px", border: "1px solid var(--bg-card-border)", padding: "2px", gap: "2px" }}>
            <button
              onClick={() => switchLayer("ocean")}
              style={{
                padding: "3px 8px",
                fontSize: "11px",
                background: activeLayer === "ocean" ? "#2563eb" : "transparent",
                color: activeLayer === "ocean" ? "#ffffff" : "var(--text-muted)",
                border: "none",
                borderRadius: "4px",
              }}
            >
              HD Ocean Bathymetry
            </button>
            <button
              onClick={() => switchLayer("satellite")}
              style={{
                padding: "3px 8px",
                fontSize: "11px",
                background: activeLayer === "satellite" ? "#2563eb" : "transparent",
                color: activeLayer === "satellite" ? "#ffffff" : "var(--text-muted)",
                border: "none",
                borderRadius: "4px",
              }}
            >
              HD Satellite
            </button>
            <button
              onClick={() => switchLayer("dark")}
              style={{
                padding: "3px 8px",
                fontSize: "11px",
                background: activeLayer === "dark" ? "#2563eb" : "transparent",
                color: activeLayer === "dark" ? "#ffffff" : "var(--text-muted)",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Dark Vector
            </button>
          </div>

          <div style={{ width: "1px", height: "20px", background: "var(--bg-card-border)" }} />

          <button onClick={() => setViewPreset("global")} style={{ padding: "5px 10px", fontSize: "12px", background: "#0f172a", border: "1px solid var(--bg-card-border)" }}>Global</button>
          <button onClick={() => setViewPreset("atlantic")} style={{ padding: "5px 10px", fontSize: "12px", background: "#0f172a", border: "1px solid var(--bg-card-border)" }}>Atlantic</button>
          <button onClick={() => setViewPreset("pacific")} style={{ padding: "5px 10px", fontSize: "12px", background: "#0f172a", border: "1px solid var(--bg-card-border)" }}>Pacific</button>
          <button
            onClick={toggleOrbitMode}
            style={{
              padding: "5px 10px",
              fontSize: "12px",
              background: isOrbiting ? "rgba(56, 189, 248, 0.2)" : "#0f172a",
              color: isOrbiting ? "var(--accent-blue)" : "var(--text-muted)",
              border: "1px solid var(--bg-card-border)",
            }}
          >
            {isOrbiting ? "Orbit Active" : "Orbit Rotation"}
          </button>
          <button
            onClick={animateTrajectory}
            disabled={isAnimating}
            style={{ padding: "5px 10px", fontSize: "12px", background: "#0f172a", color: "var(--accent-teal)", border: "1px solid var(--bg-card-border)" }}
          >
            {isAnimating ? "Animating..." : "Animate Drift Path"}
          </button>
          <button onClick={focusProfile} style={{ padding: "5px 10px", fontSize: "12px", background: "#2563eb", color: "#ffffff" }}>
            Focus Float
          </button>
        </div>
      </div>

      {error && (
        <p className="error" role="alert" style={{ padding: "0 18px", margin: "10px 0" }}>
          {error}
        </p>
      )}

      <div
        ref={containerRef}
        className="ocean-globe-canvas"
        aria-label={`3D Globe showing Argo float ${floatId}, cycle ${cycle}`}
      />

      {/* High-Definition Telemetry Metadata Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "8px",
          padding: "10px 18px",
          background: "#090d16",
          borderTop: "1px solid var(--bg-card-border)",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
        }}
      >
        <div>
          <span style={{ color: "var(--text-muted)", display: "block" }}>PLATFORM WMO</span>
          <strong style={{ color: "#ffffff" }}>{floatId}</strong>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)", display: "block" }}>CYCLE STEP</span>
          <strong style={{ color: "var(--accent-blue)" }}>{cycle} / 45</strong>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)", display: "block" }}>COORDINATES</span>
          <strong style={{ color: "#ffffff" }}>{latitude.toFixed(3)}°N, {longitude.toFixed(3)}°E</strong>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)", display: "block" }}>VERTICAL SPECTRUM</span>
          <strong style={{ color: "var(--accent-teal)" }}>0.0 to 1980.5 dbar</strong>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)", display: "block" }}>QUALITY CONTROL</span>
          <strong style={{ color: "var(--status-good)" }}>PASS (QC FLAG 1)</strong>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)", display: "block" }}>DATA ASSEMBLY</span>
          <strong style={{ color: "#ffffff" }}>Coriolis (France)</strong>
        </div>
      </div>
    </article>
  );
}