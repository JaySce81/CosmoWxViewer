---
name: Catalog universe model
description: The visualization uses individually measured catalog records in true comoving space, with unavailable observables left null.
---
The universe view must keep each catalog record independent: convert its own redshift to comoving distance with the configured ΛCDM integral, project its own radial vector from RA/Dec, and never substitute redshift shells or a spatially smoothed field for per-record measurements.

**Why:** The available DESI files currently provide RA, Dec, and redshift but no rotation or transverse-motion columns. Fabricating those values would violate the accuracy requirement.

**How to apply:** When richer BGS, ELG, LRG, or SPARC files are added, map their optional diameter, rotation, direction, and transverse-velocity columns into the existing nullable fields; preserve nulls when a source does not supply a measurement.