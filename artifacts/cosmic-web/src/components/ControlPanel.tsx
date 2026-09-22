import type { ColorMode } from "./GalaxyPoints";

interface Layers {
  galaxies: boolean;
  motionField: boolean;
  grid: boolean;
  stars: boolean;
  earth: boolean;
}

interface Props {
  layers: Layers;
  onLayerToggle: (key: keyof Layers) => void;
  colorMode: ColorMode;
  onColorMode: (mode: ColorMode) => void;
  pointSize: number;
  onPointSize: (value: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  playSpeed: number;
  onPlaySpeed: (value: number) => void;
  futureOffset: number;
  onFutureOffset: (value: number) => void;
  totalGalaxies: number;
  loadedGalaxies: number;
  isLoading: boolean;
  stats?: {
    datasets: Array<{ name: string; count: number; datasetClass: string; label: string }>;
    totalGalaxies: number;
    ready: boolean;
  };
  datasetFilter: string;
  onDatasetFilter: (dataset: string) => void;
}

const LAYER_CONFIG: Array<{ key: keyof Layers; label: string; icon: string; color: string }> = [
  { key: "galaxies", label: "Galaxies", icon: "●", color: "#a0c8ff" },
  { key: "motionField", label: "Motion Vectors", icon: "→", color: "#00faf4" },
  { key: "grid", label: "Comoving Grid", icon: "⊞", color: "#2a4a8a" },
  { key: "stars", label: "Background Stars", icon: "✦", color: "#6080a0" },
  { key: "earth", label: "Earth Marker", icon: "⊕", color: "#1a6bff" },
];

const COLOR_MODES: Array<{ value: ColorMode; label: string }> = [
  { value: "rotationSpeed", label: "Rotation speed" },
  { value: "rotationDirection", label: "Rotation direction" },
  { value: "lineOfSight", label: "LOS velocity" },
  { value: "transverse", label: "Transverse motion" },
  { value: "dataset", label: "Dataset class" },
];

export function ControlPanel({
  layers,
  onLayerToggle,
  colorMode,
  onColorMode,
  pointSize,
  onPointSize,
  isPlaying,
  onPlayToggle,
  playSpeed,
  onPlaySpeed,
  futureOffset,
  onFutureOffset,
  totalGalaxies,
  loadedGalaxies,
  isLoading,
  stats,
  datasetFilter,
  onDatasetFilter,
}: Props) {
  return (
    <div className="panel-glass rounded-xl p-4 flex flex-col gap-4" style={{ width: 250, pointerEvents: "all" }}>
      <div>
        <div className="font-bold text-sm" style={{ color: "#a0ccff" }}>Cosmic Universe Model</div>
        <div style={{ fontSize: "0.65rem", color: "rgba(140,170,220,0.6)", marginTop: 2 }}>
          True 3-D comoving coordinates
        </div>
        <div style={{ fontSize: "0.62rem", color: "rgba(120,160,200,0.5)", marginTop: 4 }}>
          {isLoading ? "Loading catalog data…" : `${loadedGalaxies.toLocaleString()} of ${totalGalaxies.toLocaleString()} galaxies rendered`}
        </div>
      </div>

      <div>
        <div className="section-label">Dataset</div>
        <select
          value={datasetFilter}
          onChange={event => onDatasetFilter(event.target.value)}
          style={{
            width: "100%", background: "rgba(10,20,50,0.8)", border: "1px solid rgba(80,120,200,0.3)",
            color: "#a0c8ff", borderRadius: 4, padding: "4px 8px", fontSize: "0.72rem", cursor: "pointer",
          }}
        >
          <option value="all">All catalog datasets</option>
          {stats?.datasets.map(dataset => (
            <option key={dataset.name} value={dataset.name}>{dataset.label}</option>
          ))}
        </select>
        {stats?.datasets && (
          <div className="mt-2 space-y-1">
            {stats.datasets.map(dataset => (
              <div key={dataset.name} className="flex justify-between items-center" style={{ fontSize: "0.6rem" }}>
                <span style={{ color: "rgba(160,190,240,0.7)" }}>{dataset.datasetClass} · {dataset.label}</span>
                <span style={{ color: "rgba(120,160,200,0.5)" }}>{(dataset.count / 1000).toFixed(0)}k</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="section-label">Layers</div>
        <div className="space-y-1">
          {LAYER_CONFIG.map(({ key, label, icon, color }) => (
            <button key={key} className={`toggle-btn ${layers[key] ? "active" : ""}`} onClick={() => onLayerToggle(key)}>
              <span style={{ color, fontSize: "0.8rem" }}>{icon}</span>
              {label}
              <span style={{ marginLeft: "auto", fontSize: "0.6rem", opacity: 0.5 }}>{layers[key] ? "ON" : "OFF"}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="section-label">Color by measured value</div>
        <select
          value={colorMode}
          onChange={event => onColorMode(event.target.value as ColorMode)}
          style={{
            width: "100%", background: "rgba(10,20,50,0.8)", border: "1px solid rgba(80,120,200,0.3)",
            color: "#a0c8ff", borderRadius: 4, padding: "5px 7px", fontSize: "0.68rem",
          }}
        >
          {COLOR_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="section-label" style={{ marginBottom: 0 }}>Visual diameter scale</span>
          <span style={{ fontSize: "0.62rem", color: "rgba(140,170,220,0.5)" }}>{pointSize.toFixed(1)}×</span>
        </div>
        <input type="range" min={0.5} max={5} step={0.1} value={pointSize} onChange={event => onPointSize(Number(event.target.value))} style={{ width: "100%" }} />
      </div>

      <div style={{ borderTop: "1px solid rgba(100,160,255,0.1)", paddingTop: 12 }}>
        <div className="section-label" style={{ color: "rgba(200,160,80,0.9)" }}>Motion preview</div>
        <div className="flex gap-2 mb-2">
          <button
            onClick={onPlayToggle}
            style={{
              flex: 1, padding: "5px", borderRadius: 4, border: "1px solid rgba(255,193,64,0.3)",
              background: isPlaying ? "rgba(255,193,64,0.15)" : "transparent",
              color: isPlaying ? "#ffc140" : "rgba(180,150,80,0.7)", fontSize: "0.72rem", cursor: "pointer",
            }}
          >{isPlaying ? "⏸ Pause" : "▶ Play"}</button>
          <button
            onClick={() => onFutureOffset(0)}
            style={{
              padding: "5px 8px", borderRadius: 4, border: "1px solid rgba(100,140,200,0.2)",
              background: "transparent", color: "rgba(140,170,220,0.5)", fontSize: "0.72rem", cursor: "pointer",
            }}
          >↺</button>
        </div>
        <div className="flex justify-between items-center mb-1">
          <span style={{ fontSize: "0.62rem", color: "rgba(200,160,80,0.7)" }}>Observed-motion offset</span>
          <span style={{ fontSize: "0.62rem", color: "rgba(200,160,80,0.7)" }}>{futureOffset.toFixed(2)} Gyr</span>
        </div>
        <input type="range" min={0} max={5} step={0.05} value={futureOffset} onChange={event => onFutureOffset(Number(event.target.value))} style={{ width: "100%" }} />
        <div className="mt-2 flex justify-between items-center">
          <span style={{ fontSize: "0.62rem", color: "rgba(160,140,80,0.6)" }}>Play speed</span>
          <span style={{ fontSize: "0.62rem", color: "rgba(160,140,80,0.6)" }}>{playSpeed.toFixed(1)}×</span>
        </div>
        <input type="range" min={0.1} max={5} step={0.1} value={playSpeed} onChange={event => onPlaySpeed(Number(event.target.value))} style={{ width: "100%" }} />
      </div>

      <div style={{ fontSize: "0.58rem", color: "rgba(100,130,180,0.4)", borderTop: "1px solid rgba(100,160,255,0.08)", paddingTop: 8 }}>
        <div>🖱 Left: rotate · Right: pan</div>
        <div>🖱 Scroll: zoom in/out</div>
        <div>📐 Positions: comoving Mpc</div>
      </div>
    </div>
  );
}