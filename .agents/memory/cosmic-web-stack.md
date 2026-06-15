---
name: Cosmic Web stack decisions
description: Key architecture choices for the Cosmic Web Visualizer that aren't obvious from the code
---

## No database
All ~3M galaxies loaded from 6 CSV files in `attached_assets/` into memory at server startup (~8s). No DATABASE_URL needed. Never import `@workspace/db`.

## WebGL detection
Must call `detectWebGL()` BEFORE mounting `<Canvas>` — otherwise Three.js throws synchronously, the Vite runtime-error-modal plugin catches it, and shows a blocking overlay. The check uses `canvas.getContext('webgl2') || canvas.getContext('webgl')`.

**Why:** Replit's preview iframe has no GPU; the error overlay was covering the entire app.

## Scale convention
1 Three.js world unit = 1000 Mpc. Galaxy z=0.6–1.1 maps to comoving 1730–3100 Mpc = 1.73–3.1 world units.

## ΛCDM coordinate conversion
H0=70, Ω_m=0.3, Ω_Λ=0.7. Comoving distance via 1000-step Riemann sum, pre-cached as Float64Array lookup table of 2000 entries over z=[0, 1.5] for fast per-galaxy calls.

## Density grid
48³ bins over ±3500 Mpc. δ = count/mean - 1. Flow field coarsened to 16³ (central-difference gradient of δ).

## Saffir-Simpson color mapping
Void (δ<-0.8) = high pressure blue → Supercluster (δ>7) = Cat 5 red. Same NHC track color palette.
