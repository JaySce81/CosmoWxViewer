import { DATASET_COLORS, DATASET_LABELS } from "../lib/cosmicColors";

interface Layers {
  galaxies: boolean;
  flowField: boolean;
  densityContours: boolean;
  grid: boolean;
  stars: boolean;
  earth: boolean;
}

interface Props {
  layers: Layers;
  onLayerToggle: (key: keyof Layers) => void;
  colorMode: "density" | "redshift" | "dataset";
  onColorMode: (m: "density" | "redshift" | "dataset") => void;
  pointSize: number;
  onPointSize: (v: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  playSpeed: number;
  onPlaySpeed: (v: number) => void;
  futureOffset: number;
  onFutureOffset: (v: number) => void;
  totalGalaxies: number;
  loadedGalaxies: number;
  isLoading: boolean;
  datasetFilter: string;
  onDatasetFilter: (d: string) => void;
  stats?: {
    datasets: Array<{ name: string; count: number; zMin: number; zMax: number; label: string }>;
    totalGalaxies: number;
    ready: boolean;
  };
}

const LAYER_CONFIG: Array<{ key: keyof Layers; label: string; icon: string; color: string }> = [
  { key: "galaxies",        label: "Galaxies",        icon: "●", color: "#a0c8ff" },
  { key: "densityContours", label: "Density Field",   icon: "◌", color: "#ffc140" },
  { key: "flowField",       label: "Flow / Steering", icon: "→", color: "#00faf4" },
  { key: "grid",            label: "Scale Grid",      icon: "⊞", color: "#2a4a8a" },
  { key: "stars",           label: "Background Stars",icon: "✦", color: "#6080a0" },
  { key: "earth",           label: "Earth Marker",    icon: "⊕", color: "#1a6bff" },
];

export function ControlPanel({
  layers, onLayerToggle, colorMode, onColorMode, pointSize, onPointSize,
  isPlaying, onPlayToggle, playSpeed, onPlaySpeed, futureOffset, onFutureOffset,
  totalGalaxies, loadedGalaxies, isLoading, datasetFilter, onDatasetFilter, stats,
}: Props) {
  return (
    <div
      className="panel-glass rounded-xl p-4 flex flex-col gap-4"
      style={{ width: 230, pointerEvents: "all" }}
    >
      {/* Header */}
      <div>
        <div className="font-bold text-sm" style={{ color: "#a0ccff" }}>
          Cosmic Web Visualizer
        </div>
        <div style={{ fontSize: "0.65rem", color: "rgba(140,170,220,0.6)", marginTop: 2 }}>
          Earth-centered · ΛCDM Cosmology
        </div>
        <div style={{ fontSize: "0.62rem", color: "rgba(120,160,200,0.5)", marginTop: 4 }}>
          {isLoading ? (
            <span className="loading-pulse" style={{ color: "#ffc140" }}>Loading galaxy data…</span>
          ) : (
            <span>{loadedGalaxies.toLocaleString()} of {totalGalaxies.toLocaleString()} galaxies rendered</span>
          )}
        </div>
        {!stats?.ready && (
          <div className="loading-pulse mt-1" style={{ fontSize: "0.6rem", color: "#ffc140" }}>
            Server indexing {(stats?.totalGalaxies ?? 0).toLocaleString()} galaxies…
          </div>
        )}
      </div>

      {/* Dataset filter */}
      <div>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(160,192,255,0.8)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Dataset
        </div>
        <select
          value={datasetFilter}
          onChange={e => onDatasetFilter(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(10,20,50,0.8)",
            border: "1px solid rgba(80,120,200,0.3)",
            color: "#a0c8ff",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: "0.72rem",
            cursor: "pointer",
          }}
        >
          <option value="all">All Datasets</option>
          {Object.entries(DATASET_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v} ({k})</option>
          ))}
        </select>

        {stats?.datasets && (
          <div className="mt-2 space-y-1">
            {stats.datasets.slice(0, 3).map(ds => (
              <div key={ds.name} className="flex justify-between items-center" style={{ fontSize: "0.6rem" }}>
                <div className="flex items-center gap-1">
                  <div className="dot" style={{ width: 6, height: 6, background: DATASET_COLORS[ds.name] ?? "#888" }} />
                  <span style={{ color: "rgba(160,190,240,0.7)" }}>{ds.label}</span>
                </div>
                <span style={{ color: "rgba(120,160,200,0.5)" }}>{(ds.count / 1000).toFixed(0)}k</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Layers */}
      <div>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(160,192,255,0.8)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Layers
        </div>
        <div className="space-y-1">
          {LAYER_CONFIG.map(({ key, label, icon, color }) => (
            <button
              key={key}
              className={`toggle-btn ${layers[key] ? "active" : ""}`}
              onClick={() => onLayerToggle(key)}
            >
              <span style={{ color, fontSize: "0.8rem" }}>{icon}</span>
              {label}
              <span style={{ marginLeft: "auto", fontSize: "0.6rem", opacity: 0.5 }}>
                {layers[key] ? "ON" : "OFF"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Color Mode */}
      <div>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(160,192,255,0.8)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Color By
        </div>
        <div className="flex gap-1">
          {(["density", "redshift", "dataset"] as const).map(m => (
            <button
              key={m}
              onClick={() => onColorMode(m)}
              style={{
                flex: 1,
                fontSize: "0.62rem",
                padding: "4px 6px",
                borderRadius: 3,
                cursor: "pointer",
                transition: "all 0.15s",
                border: `1px solid ${colorMode === m ? "rgba(94,186,255,0.4)" : "rgba(60,80,140,0.3)"}`,
                background: colorMode === m ? "rgba(94,186,255,0.12)" : "transparent",
                color: colorMode === m ? "#a0ccff" : "rgba(140,170,220,0.5)",
                textTransform: "capitalize",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Point Size */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(160,192,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Point Size
          </span>
          <span style={{ fontSize: "0.62rem", color: "rgba(140,170,220,0.5)" }}>{pointSize.toFixed(1)}</span>
        </div>
        <input
          type="range" min={0.5} max={5} step={0.1}
          value={pointSize}
          onChange={e => onPointSize(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* Futurecast */}
      <div style={{ borderTop: "1px solid rgba(100,160,255,0.1)", paddingTop: 12 }}>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(200,160,80,0.9)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Futurecast
        </div>

        <div className="flex gap-2 mb-2">
          <button
            onClick={onPlayToggle}
            style={{
              flex: 1,
              padding: "5px",
              borderRadius: 4,
              border: "1px solid rgba(255,193,64,0.3)",
              background: isPlaying ? "rgba(255,193,64,0.15)" : "transparent",
              color: isPlaying ? "#ffc140" : "rgba(180,150,80,0.7)",
              fontSize: "0.72rem",
              cursor: "pointer",
            }}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            onClick={() => onFutureOffset(0)}
            style={{
              padding: "5px 8px",
              borderRadius: 4,
              border: "1px solid rgba(100,140,200,0.2)",
              background: "transparent",
              color: "rgba(140,170,220,0.5)",
              fontSize: "0.72rem",
              cursor: "pointer",
            }}
          >
            ↺
          </button>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: "0.62rem", color: "rgba(200,160,80,0.7)" }}>Time offset</span>
            <span style={{ fontSize: "0.62rem", color: "rgba(200,160,80,0.7)" }}>{futureOffset.toFixed(2)} Gyr</span>
          </div>
          <input
            type="range" min={0} max={5} step={0.05}
            value={futureOffset}
            onChange={e => onFutureOffset(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div className="mt-2">
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: "0.62rem", color: "rgba(160,140,80,0.6)" }}>Play speed</span>
            <span style={{ fontSize: "0.62rem", color: "rgba(160,140,80,0.6)" }}>{playSpeed.toFixed(1)}×</span>
          </div>
          <input
            type="range" min={0.1} max={5} step={0.1}
            value={playSpeed}
            onChange={e => onPlaySpeed(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {/* Controls hint */}
      <div style={{ fontSize: "0.58rem", color: "rgba(100,130,180,0.4)", borderTop: "1px solid rgba(100,160,255,0.08)", paddingTop: 8 }}>
        <div>🖱 Left: rotate · Right: pan</div>
        <div>🖱 Scroll: zoom in/out</div>
        <div>📐 Scale: 1 unit = 1,000 Mpc</div>
      </div>
    </div>
  );
}
