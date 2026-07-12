import { useCallback } from "react";
import { Galaxy } from "./GalaxyPoints";
import { DENSITY_SCALE, DATASET_LABELS } from "../lib/cosmicColors";

interface Props {
  galaxy: Galaxy | null;
  onClose: () => void;
}

function structureName(delta: number): string {
  for (const s of DENSITY_SCALE) {
    if (delta < s.threshold) return s.label;
  }
  return DENSITY_SCALE[DENSITY_SCALE.length - 1].label;
}

function structureCategory(delta: number): string {
  for (const s of DENSITY_SCALE) {
    if (delta < s.threshold) return s.category;
  }
  return DENSITY_SCALE[DENSITY_SCALE.length - 1].category;
}

export function GalaxyInfoCard({ galaxy, onClose }: Props) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  if (!galaxy) return null;

  const delta = galaxy.density;
  const name = structureName(delta);
  const cat = structureCategory(delta);

  // Angular size: galaxy at distance D has angular size ~10 kpc / D(Mpc) ≈ 0.002°
  // (LRGs are ~30-50 kpc; angular size ~0.005-0.008° = 20-30 arcsec)
  const angularSizeArcsec = (40 / galaxy.distance) * 206265; // 40 kpc / D(Mpc) in arcsec

  // Peculiar velocity estimate from density: v_pec ≈ H₀ × f × δ × D(z) / (1+z)
  const fOmega = Math.pow(0.3, 0.545); // growth factor f(Ωₘ) ≈ Ωₘ^0.545
  const vPecApprox = 70 * fOmega * delta * galaxy.distance / (1 + galaxy.redshift); // km/s

  // Comoving volume element at this z: dV_c = D_c² × dΩ × (c/H₀) × dz / E(z)
  // For 1 sr, dz=0.01: dV ≈ D² × (c/H₀/E(z)) × 0.01 Mpc³

  return (
    <div
      className="panel-glass"
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
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
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#a0ccff" }}>
            Galaxy Information
          </div>
          <div style={{ fontSize: "0.6rem", color: "rgba(140,170,220,0.5)", marginTop: 2 }}>
            DESI LRG spectroscopic sample
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

      {/* Structure type badge */}
      <div style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: "0.65rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 12,
        background: delta < 0 ? "rgba(0,200,255,0.15)" : delta < 1 ? "rgba(255,255,150,0.15)" : "rgba(255,80,80,0.15)",
        color: delta < 0 ? "#4ec4ff" : delta < 1 ? "#e8e070" : "#ff8080",
        border: `1px solid ${delta < 0 ? "rgba(0,200,255,0.3)" : delta < 1 ? "rgba(255,255,150,0.3)" : "rgba(255,80,80,0.3)"}`,
      }}>
        {name} {cat !== "H" && cat !== "TD" && cat !== "TS" ? `(Cat ${cat})` : `(${cat})`}
      </div>

      {/* Coordinates table */}
      <table style={{ width: "100%", fontSize: "0.72rem", borderCollapse: "collapse" }}>
        <tbody>
          <InfoRow label="Right Ascension" value={`${galaxy.ra.toFixed(4)}°`} />
          <InfoRow label="Declination" value={`${galaxy.dec >= 0 ? "+" : ""}${galaxy.dec.toFixed(4)}°`} />
          <InfoRow label="Redshift z" value={galaxy.redshift.toFixed(4)} />
          <InfoRow label="Comoving Distance" value={`${galaxy.distance.toFixed(0)} Mpc`} />
          <InfoRow label="Light Travel Time" value={`${(galaxy.distance / 3.26e3 / (1 + galaxy.redshift)).toFixed(2)} Gyr`} />
          <InfoRow label="Density Contrast δ" value={`${delta > 0 ? "+" : ""}${delta.toFixed(3)}`} highlight />
          <InfoRow label="Angular Size" value={`${angularSizeArcsec.toFixed(1)}″`} />
          <InfoRow label="Est. Peculiar v" value={`${Math.abs(vPecApprox).toFixed(0)} km/s`} />
          <InfoRow label="Dataset" value={DATASET_LABELS[galaxy.dataset] ?? galaxy.dataset} />
        </tbody>
      </table>

      {/* Physical context */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(80,120,200,0.15)" }}>
        <div style={{ fontSize: "0.6rem", color: "rgba(140,170,220,0.5)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Physical Context
        </div>
        <div style={{ fontSize: "0.65rem", color: "rgba(160,190,240,0.7)", lineHeight: 1.6 }}>
          {delta < -0.5
            ? `In a cosmic void. Matter density is ${((1 + delta) * 100).toFixed(1)}% of cosmic mean. Galaxies here are streaming outward along the Hubble flow.`
            : delta < 0
            ? `Slightly underdense region (${((1 + delta) * 100).toFixed(1)}% of mean). Mild expansion relative to the Hubble flow.`
            : delta < 1
            ? `Near-average density. Typical large-scale environment. Peculiar velocity ~${Math.abs(vPecApprox).toFixed(0)} km/s.`
            : delta < 3
            ? `Within a cosmic filament. Density ${((1 + delta) * 100).toFixed(0)}% above mean. Strong gravitational infall toward nearby clusters.`
            : delta < 7
            ? `Near a galaxy cluster. Density ${((1 + delta) * 100).toFixed(0)}% above mean. Significant virialized motion expected.`
            : `In a supercluster core. Density ${((1 + delta) * 100).toFixed(0)}% above mean. Heavily virialized, complex velocity field.`}
        </div>
      </div>

      {/* Accuracy note */}
      <div style={{ marginTop: 10, fontSize: "0.55rem", color: "rgba(120,150,200,0.4)", lineHeight: 1.5, fontStyle: "italic" }}>
        ΛCDM H₀=70, Ωₘ=0.3, Ω_Λ=0.7. Distances are comoving.
        Peculiar velocity is an estimate from density contrast via linear theory.
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
