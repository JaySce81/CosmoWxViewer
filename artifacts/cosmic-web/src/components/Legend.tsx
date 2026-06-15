import { DENSITY_SCALE } from "../lib/cosmicColors";

export function Legend() {
  return (
    <div className="panel-glass rounded-lg p-3 text-xs">
      <div className="font-bold text-blue-300 mb-2 tracking-wide uppercase" style={{ fontSize: "0.65rem" }}>
        Saffir-Simpson Density Scale
      </div>

      {/* Gradient bar */}
      <div className="saffir-gradient h-2 rounded-full mb-2" />

      {/* Labels */}
      <div className="space-y-1">
        {DENSITY_SCALE.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="dot" style={{ background: s.color, boxShadow: `0 0 4px ${s.color}60` }} />
            <span
              className="category-badge"
              style={{
                background: `${s.color}22`,
                color: s.color,
                border: `1px solid ${s.color}44`,
              }}
            >
              {s.category === "H" ? "High" :
               s.category === "TD" ? "TD" :
               s.category === "TS" ? "TS" :
               `Cat ${s.category}`}
            </span>
            <span style={{ color: "rgba(180,200,255,0.7)", fontSize: "0.65rem" }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgba(100,160,255,0.1)" }}>
        <div className="font-bold text-blue-300 mb-1 tracking-wide uppercase" style={{ fontSize: "0.65rem" }}>
          Flow Field Colors
        </div>
        <div className="flex gap-2 items-center" style={{ fontSize: "0.62rem", color: "rgba(160,185,255,0.7)" }}>
          <div style={{ width: 16, height: 3, background: "linear-gradient(to right, #0066ff, #ffcc00, #ff0000)" }} className="rounded" />
          <span>Low → High velocity</span>
        </div>
      </div>

      <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(100,160,255,0.1)", fontSize: "0.62rem", color: "rgba(140,170,255,0.5)" }}>
        <div>Cosmology: H₀=70, Ω<sub>m</sub>=0.3</div>
        <div>DESI LRG z=0.6–1.1</div>
        <div>~3M galaxies total</div>
      </div>
    </div>
  );
}
