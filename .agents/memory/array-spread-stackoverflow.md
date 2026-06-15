---
name: Array spread stack overflow
description: Spreading large arrays (500k+ elements) with push(...arr) exceeds call stack
---

## Rule
Never use `array.push(...largeArray)` when `largeArray` has more than ~100k elements.

**Why:** JavaScript implements spread args via call stack frames. At ~500k elements it throws `RangeError: Maximum call stack size exceeded`.

## How to apply
Use a for loop instead:
```typescript
// WRONG — stack overflow at 500k elements
allGalaxies.push(...datasetGalaxies);

// CORRECT — O(n) stack depth of 1
for (const g of datasetGalaxies) allGalaxies.push(g);
```

Alternatively: `allGalaxies = allGalaxies.concat(datasetGalaxies)` (creates new array, safe but allocates).
