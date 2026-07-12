import { useCallback } from "react";
import { DENSITY_SCALE } from "../lib/cosmicColors";

interface Cluster {
  x: number; y: number; z: number;
  density: number;
  estimatedCount: number;
}

interface Props {
  cluster: Cluster | null;
  onClose: () => void;
}

function structureName(delta: number): string {
  for (const s of DENSITY_SCALE) {
    if (delta < s.threshold) return s.label;
  }
  return DENSITY_SCALE[DENSITY_SCALE.length - 1].label;
}

export function ClusterInfoCard({ cluster, onClose }: Props) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  if (!cluster) return null;

  const name = structureName(cluster.density);

  // Convert Cartesian Mpc to approximate RA/Dec for display
  const dist = Math.sqrt(cluster.x ** 2 + cluster.y ** 2 + cluster.z ** 2);
  const ra = (Math.atan2(cluster.y, cluster.x) * 180 / Math.PI + 360) % 360;
  const dec = Math.asin(cluster.z / dist) * 180 / Math.PI;

  // Redshift estimate from distance: z ≈ D_c × H₀ / c for low z, but here z=0.6-1.1
  // Use rough inverse: for z~0.75, D_c~2100. Approx z ≈ D_c / 3000 (rough)
  const estRedshift = Math.max(0.5, Math.min(1.2, dist / 2900));

  return (
    <div
      className="panel-glass"
      style={{
        position: "absolute",
        bottom: 20,
        right: 350,
        width: 320,
        maxHeight: "calc(100vh - 100px)",
        overflowY: "auto",
        zIndex: 20,
        padding: 16,
        borderRadius: 12,
        pointerEvents: "all",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#a0ccff" }}>
            Cluster / Overdense Region
          </div>
          <div style={{ fontSize: "0.6rem", color: "rgba(140,170,220,0.5)", marginTop: 2 }}>
            450 Mpc cell from density grid
          </div>
        </div>
        <button
          onClick={handleClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(160,190,240,0.5)", fontSize: "1.1rem", lineHeight: 1,
            padding: "0 4px",
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: "0.65rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 12,
        background: "rgba(255,80,80,0.15)",
        color: "#ff8080",
        border: "1px solid rgba(255,80,80,0.3)",
      }}>
        {name}
      </div>

      <table style={{ width: "100%", fontSize: "0.72rem", borderCollapse: "collapse" }}>
        <tbody>
          <InfoRow label="Right Ascension" value={`${ra.toFixed(2)}°`} />
          <InfoRow label="Declination" value={`${dec >= 0 ? "+" : ""}${dec.toFixed(2)}°`} />
          <InfoRow label="Est. Redshift" value={estRedshift.toFixed(2)} />
          <InfoRow label="Comoving Distance" value={`${dist.toFixed(0)} Mpc`} />
          <InfoRow label="Density Contrast δ" value={`+${cluster.density.toFixed(2)}`} highlight />
          <InfoRow label="Est. Galaxy Count" value={`${cluster.estimatedCount.toLocaleString()}`} highlight />
        </tbody>
      </table>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(80,120,200,0.15)" }}>
        <div style={{ fontSize: "0.6rem", color: "rgba(140,170,220,0.5)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Physical Context
        </div>
        <div style={{ fontSize: "0.65rem", color: "rgba(160,190,240,0.7)", lineHeight: 1.6 }}>
          This 450 Mpc³ cell has {((1 + cluster.density) * 100).toFixed(0)}% of mean cosmic density.
          {cluster.density > 3
            ? " A significant overdensity — galaxies here are gravitationally bound and falling inward."
            : cluster.density > 1
            ? " A moderate overdensity along a cosmic filament."
            : " A weak overdensity, transitioning to average density."}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: "0.55rem", color: "rgba(120,150,200,0.4)", lineHeight: 1.5, fontStyle: "italic" }}>
        Note: cluster position is cell-center, not individual galaxy. Count is estimated from density contrast.
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr>
      <td style={{ padding: "3px 0", color: "rgba(140,170,220,0.55)", width: "45%", verticalAlign: "top" }}>
        {label}
      </td>
      <td style={{
        padding: "3px 0",
        color: highlight ? "#a0ccff" : "rgba(180,210,255,0.8)",
        fontWeight: highlight ? 600 : 400,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </td>
    </tr>
  );
}
