---
name: True-Mpc scale migration
description: Switching from a compressed 1/1000 scale to 1 Mpc per world unit requires touching camera, controls, markers, and HUD, not just the SCALE constant.
---
The previous SCALE was 1/1000 (1 world unit = 1000 Mpc). Changing to 1 world unit = 1 Mpc for a Stellarium-like experience requires updating all world-space sizes:

- Camera far plane, near plane, and initial position.
- OrbitControls min/max distance and zoom speed.
- Galaxy point sizes, cluster marker radii, Earth marker, selected-galaxy highlight.
- Scale grid and background starfield radii.
- A dynamic HUD scale bar that recomputes the Mpc length of a fixed-pixel bar based on camera distance and FOV.

Use `logarithmicDepthBuffer` to avoid z-fighting across the large range.
