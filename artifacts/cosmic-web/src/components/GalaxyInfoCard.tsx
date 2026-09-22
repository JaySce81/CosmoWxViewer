import { useCallback } from "react";
import type { Galaxy } from "./GalaxyPoints";

interface Props {
  galaxy: Galaxy | null;
  onClose: () => void;
}

export function GalaxyInfoCard({ galaxy, onClose }: Props) {
  const handleClose = useCallback(() => onClose(), [onClose]);
  if (!galaxy) return null;

  return (
    <div
      className="panel-glass"
      style={{
        position: "absolute", bottom: 20, right: 20, width: 340, maxHeight: "calc(100vh - 100px)",
        overflowY: "auto", zIndex: 20, padding: 16, borderRadius: 12, pointerEvents: "all",
      }}
      onClick={event => event.stopPropagation()}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#a0ccff" }}>Galaxy measurement</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(140,170,220,0.5)", marginTop: 2 }}>
            {galaxy.datasetClass} catalog record
          </div>
        </div>
        <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(160,190,240,0.5)", fontSize: "1.1rem", lineHeight: 1, padding: "0 4px" }} aria-label="Close">×</button>
      </div>

      <div style={{ color: "#6eb5ff", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        Observed position
      </div>
      <table style={{ width: "100%", fontSize: "0.65rem", borderCollapse: "collapse" }}>
        <tbody>
          <InfoRow label="Right ascension" value={`${galaxy.ra.toFixed(5)}°`} />
          <InfoRow label="Declination" value={`${galaxy.dec.toFixed(5)}°`} />
          <InfoRow label="Redshift" value={galaxy.redshift.toFixed(7)} highlight />
          <InfoRow label="Comoving distance" value={`${galaxy.distance.toFixed(2)} Mpc`} highlight />
          <InfoRow label="Scale factor a(z)" value={galaxy.scaleFactor.toFixed(5)} />
          <InfoRow label="Physical distance at emission" value={`${galaxy.physicalDistanceAtEmissionMpc.toFixed(2)} Mpc`} />
          <InfoRow label="Comoving X" value={`${galaxy.x.toFixed(2)} Mpc`} />
          <InfoRow label="Comoving Y" value={`${galaxy.y.toFixed(2)} Mpc`} />
          <InfoRow label="Comoving Z" value={`${galaxy.z.toFixed(2)} Mpc`} />
        </tbody>
      </table>

      <div style={{ color: "#6eb5ff", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: "14px 0 8px" }}>
        Catalog properties
      </div>
      <table style={{ width: "100%", fontSize: "0.65rem", borderCollapse: "collapse" }}>
        <tbody>
          <InfoRow label="Dataset" value={`${galaxy.datasetClass} · ${galaxy.dataset}`} />
          <InfoRow label="Diameter" value={`${galaxy.diameterKpc.toFixed(1)} kpc (${galaxy.diameterSource === "catalog" ? "catalog" : "typical class range"})`} />
          <InfoRow label="Rotation speed" value={formatNullable(galaxy.rotationSpeedKms, "km/s")} />
          <InfoRow label="Rotation direction" value={galaxy.rotationDirection ?? "Not supplied"} />
        </tbody>
      </table>

      <div style={{ color: "#6eb5ff", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: "14px 0 8px" }}>
        Motion relative to Earth
      </div>
      <table style={{ width: "100%", fontSize: "0.65rem", borderCollapse: "collapse" }}>
        <tbody>
          <InfoRow label="Line-of-sight velocity" value={`${galaxy.lineOfSightVelocityKms.toFixed(1)} km/s`} highlight />
          <InfoRow label="Transverse velocity" value={formatNullable(galaxy.transverseVelocityKms, "km/s")} />
          <InfoRow label="3-D vector" value={`(${galaxy.vx.toFixed(1)}, ${galaxy.vy.toFixed(1)}, ${galaxy.vz.toFixed(1)}) km/s`} />
          <InfoRow label="Vector source" value="Spectroscopic redshift" />
        </tbody>
      </table>

      <div style={{ marginTop: 12, fontSize: "0.55rem", color: "rgba(120,150,200,0.5)", lineHeight: 1.5, fontStyle: "italic" }}>
        Position uses the supplied redshift and numerical ΛCDM integration with H₀=67.4, Ωₘ=0.315, ΩΛ=0.685. Rotation and transverse values remain unavailable when the source catalog does not provide them.
      </div>
    </div>
  );
}

function formatNullable(value: number | null, unit: string): string {
  return value == null ? "Not supplied" : `${value.toFixed(1)} ${unit}`;
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr>
      <td style={{ padding: "3px 0", color: "rgba(140,170,220,0.55)", width: "43%", verticalAlign: "top" }}>{label}</td>
      <td style={{ padding: "3px 0", color: highlight ? "#a0ccff" : "rgba(180,210,255,0.8)", fontWeight: highlight ? 600 : 400, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}</td>
    </tr>
  );
}