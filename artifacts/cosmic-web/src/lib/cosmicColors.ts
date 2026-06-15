import * as THREE from "three";

// Saffir-Simpson inspired density color scale
// Voids = high pressure (clear/blue) → Superclusters = Category 5 (red)
export const DENSITY_SCALE = [
  { threshold: -0.80, color: "#B0E0E6", label: "High (Void)",        category: "H"  },
  { threshold: -0.50, color: "#5ebaff", label: "Underdense",          category: "TD" },
  { threshold:  0.00, color: "#00faf4", label: "Below Average",       category: "TS" },
  { threshold:  1.00, color: "#ffffcc", label: "Average",             category: "1"  },
  { threshold:  3.00, color: "#ffc140", label: "Filament",            category: "3"  },
  { threshold:  7.00, color: "#ff8f20", label: "Cluster",             category: "4"  },
  { threshold: Infinity, color: "#ff6060", label: "Supercluster",     category: "5"  },
];

export function densityToColor(delta: number): THREE.Color {
  for (const s of DENSITY_SCALE) {
    if (delta < s.threshold) {
      return new THREE.Color(s.color);
    }
  }
  return new THREE.Color(DENSITY_SCALE[DENSITY_SCALE.length - 1].color);
}

export function densityToHex(delta: number): string {
  for (const s of DENSITY_SCALE) {
    if (delta < s.threshold) return s.color;
  }
  return DENSITY_SCALE[DENSITY_SCALE.length - 1].color;
}

export function velocityMagnitudeColor(magnitude: number, maxMag: number): THREE.Color {
  const t = Math.min(magnitude / maxMag, 1.0);
  const r = t;
  const g = 1.0 - t;
  const b = 0.5 * (1.0 - t);
  return new THREE.Color(r, g, b);
}

// Dataset color tags
export const DATASET_COLORS: Record<string, string> = {
  lrg60:  "#6eb5ff",
  lrg70:  "#00e5d0",
  lrg80:  "#a8e063",
  lrg90:  "#ffcd60",
  lrg100: "#ff9860",
  lrg2:   "#e080ff",
};

export const DATASET_LABELS: Record<string, string> = {
  lrg60:  "z=0.6–0.7",
  lrg70:  "z=0.7–0.8",
  lrg80:  "z=0.8–0.9",
  lrg90:  "z=0.9–1.0",
  lrg100: "z=1.0–1.1",
  lrg2:   "LRG2",
};
