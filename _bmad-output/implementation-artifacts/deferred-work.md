# Deferred Work

## Deferred from: code review of story 1.4 (2026-08-11)

- No error isolation between phases [src/main.ts:28-32] — if any phase throws, remaining phases skipped. Deferred: skeleton stage, phases empty stubs.
- Zero Colony Memory test vacuous [test/control-cycle.test.ts:89-108] — test passes trivially because phases empty. Deferred: skeleton stage, acceptable placeholder.
- AC1 [module] vs [control] ambiguity [src/config.ts:13] — AC1 says "[module]-prefixed" but implementation uses literal "[control]". Deferred: defensible reading.
- Sprint-status premature [sprint-status.yaml] — status bumped to review but AC3 AD-10 seam unmet. Deferred: depends on AC3 decision.
- NaN from getUsed() [src/control/metering.ts:8,11] — if getUsed() returns NaN, delta.toFixed(2) = "NaN". Deferred: edge case.
