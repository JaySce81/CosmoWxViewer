interface Props {
  stats?: {
    datasets: Array<{ name: string; count: number; datasetClass: string; label: string }>;
  };
}

export function Legend({ stats }: Props) {
  return (
    <div className="panel-glass rounded-lg p-3 text-xs">
      <div className="font-bold text-blue-300 mb-2 tracking-wide uppercase" style={{ fontSize: "0.65rem" }}>
        Catalog measurements
      </div>
      <div className="space-y-1" style={{ color: "rgba(180,200,255,0.7)", fontSize: "0.65rem" }}>
        <div><span style={{ color: "#ff8b35" }}>●</span> LOS velocity from spectroscopic redshift</div>
        <div><span style={{ color: "#20d7ff" }}>●</span> Rotation speed when SPARC is present</div>
        <div><span style={{ color: "#ff9f40" }}>●</span> CW rotation direction</div>
        <div><span style={{ color: "#20d7ff" }}>●</span> CCW rotation direction</div>
        <div><span style={{ color: "#526080" }}>●</span> Unavailable measurement</div>
      </div>
      <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgba(100,160,255,0.1)" }}>
        <div className="font-bold text-blue-300 mb-1 tracking-wide uppercase" style={{ fontSize: "0.65rem" }}>
          Loaded datasets
        </div>
        {stats?.datasets.map(dataset => (
          <div key={dataset.name} style={{ fontSize: "0.62rem", color: "rgba(160,185,255,0.7)" }}>
            {dataset.datasetClass} · {dataset.label} · {(dataset.count / 1000).toFixed(0)}k
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgba(100,160,255,0.1)", fontSize: "0.62rem", color: "rgba(140,170,255,0.55)" }}>
        <div>ΛCDM: H₀=67.4, Ωₘ=0.315, ΩΛ=0.685</div>
        <div>Positions: true comoving Mpc</div>
        <div>Transverse / rotation data shown only when supplied</div>
      </div>
    </div>
  );
}