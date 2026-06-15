import { useState, useCallback, useEffect } from "react";
import {
  useGetGalaxies,
  useGetDensityGrid,
  useGetGalaxyStats,
  getGetGalaxyStatsQueryKey,
  getGetGalaxiesQueryKey,
  getGetDensityGridQueryKey,
} from "@workspace/api-client-react";
import { CosmicViewer } from "../components/CosmicViewer";
import { ControlPanel } from "../components/ControlPanel";
import { Legend } from "../components/Legend";

interface Layers {
  galaxies: boolean;
  flowField: boolean;
  densityContours: boolean;
  grid: boolean;
  stars: boolean;
  earth: boolean;
}

export function CosmicPage() {
  const [layers, setLayers] = useState<Layers>({
    galaxies: true,
    flowField: false,
    densityContours: false,
    grid: true,
    stars: true,
    earth: true,
  });
  const [colorMode, setColorMode] = useState<"density" | "redshift" | "dataset">("density");
  const [pointSize, setPointSize] = useState(1.8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1.0);
  const [futureOffset, setFutureOffset] = useState(0);
  const [datasetFilter, setDatasetFilter] = useState("all");

  // Stats — poll every 3s while server is loading, stop once ready
  const { data: statsData } = useGetGalaxyStats({
    query: {
      queryKey: getGetGalaxyStatsQueryKey(),
      refetchInterval: (query) =>
        (query.state.data as { ready?: boolean })?.ready ? false : 3000,
      staleTime: 5000,
    },
  });

  const serverReady = statsData?.ready === true;

  // Galaxy data — only fetch once server is ready
  const galaxyParams = { sample: 80000, dataset: datasetFilter };
  const { data: galaxyData, isLoading: galaxiesLoading, refetch: refetchGalaxies } = useGetGalaxies(
    galaxyParams,
    {
      query: {
        queryKey: getGetGalaxiesQueryKey(galaxyParams),
        enabled: serverReady,
        staleTime: 60000,
      },
    }
  );

  // Density / flow grid — fetch once, never stale
  const gridParams = { resolution: 16 };
  const { data: gridData } = useGetDensityGrid(
    gridParams,
    {
      query: {
        queryKey: getGetDensityGridQueryKey(gridParams),
        enabled: serverReady,
        staleTime: Infinity,
      },
    }
  );

  // Refetch galaxies when dataset filter changes
  useEffect(() => {
    if (serverReady) void refetchGalaxies();
  }, [datasetFilter, serverReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLayerToggle = useCallback((key: keyof Layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handlePlayToggle = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const galaxies = galaxyData?.galaxies ?? [];
  const flowCells = gridData?.cells ?? [];

  useEffect(() => { document.title = "Cosmic Web Visualizer"; }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      {/* 3D Canvas */}
      <div style={{ position: "absolute", inset: 0 }}>
        <CosmicViewer
          galaxies={galaxies}
          flowCells={flowCells}
          layers={layers}
          colorMode={colorMode}
          pointSize={pointSize}
          isPlaying={isPlaying}
          playSpeed={playSpeed}
          futureOffset={futureOffset}
          onFutureOffsetChange={setFutureOffset}
        />
      </div>

      {/* Top bar */}
      <div
        className="panel-glass"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 44,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", zIndex: 10,
          borderTop: "none", borderLeft: "none", borderRight: "none", borderRadius: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6eb5ff", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            ✦ Cosmic Web Visualizer
          </span>
          <span style={{ fontSize: "0.62rem", color: "rgba(130,160,210,0.5)" }}>
            Earth-centered · DESI Survey · z=0.6–1.1
          </span>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: "0.62rem", color: "rgba(140,170,220,0.6)" }}>
          <span>H₀=70 km/s/Mpc</span>
          <span>Ω<sub>m</sub>=0.3</span>
          <span>Ω<sub>Λ</sub>=0.7</span>
          <span>ΛCDM</span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.62rem" }}>
          {!serverReady && (
            <span className="loading-pulse" style={{ color: "#ffc140" }}>
              Indexing {(statsData?.totalGalaxies ?? 0).toLocaleString()} galaxies…
            </span>
          )}
          {serverReady && galaxiesLoading && (
            <span className="loading-pulse" style={{ color: "#a0d0ff" }}>Loading…</span>
          )}
          {serverReady && !galaxiesLoading && galaxies.length > 0 && (
            <span style={{ color: "rgba(100,220,100,0.8)" }}>
              ● {galaxies.length.toLocaleString()} galaxies
            </span>
          )}
          {futureOffset > 0 && (
            <span style={{ color: "#ffc140", fontWeight: 600 }}>
              ⟳ +{futureOffset.toFixed(2)} Gyr
            </span>
          )}
        </div>
      </div>

      {/* Left panel */}
      <div style={{ position: "absolute", top: 52, left: 16, zIndex: 10, pointerEvents: "none", maxHeight: "calc(100vh - 70px)", overflowY: "auto" }}>
        <ControlPanel
          layers={layers}
          onLayerToggle={handleLayerToggle}
          colorMode={colorMode}
          onColorMode={setColorMode}
          pointSize={pointSize}
          onPointSize={setPointSize}
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
          playSpeed={playSpeed}
          onPlaySpeed={setPlaySpeed}
          futureOffset={futureOffset}
          onFutureOffset={setFutureOffset}
          totalGalaxies={galaxyData?.total ?? statsData?.totalGalaxies ?? 0}
          loadedGalaxies={galaxies.length}
          isLoading={!serverReady || galaxiesLoading}
          serverReady={serverReady}
          datasetFilter={datasetFilter}
          onDatasetFilter={setDatasetFilter}
          stats={statsData}
        />
      </div>

      {/* Right: Legend */}
      <div style={{ position: "absolute", top: 52, right: 16, zIndex: 10, width: 224 }}>
        <Legend />
      </div>

      {/* Bottom: Scale bar */}
      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: "0.6rem", color: "rgba(120,160,210,0.5)" }}>
          <div style={{ width: 1, height: 8, background: "rgba(120,160,210,0.4)" }} />
          <div style={{ width: 60, height: 2, background: "rgba(120,160,210,0.4)" }} />
          <div style={{ width: 1, height: 8, background: "rgba(120,160,210,0.4)" }} />
          <span style={{ marginLeft: 6 }}>500 Mpc</span>
        </div>
      </div>
    </div>
  );
}
