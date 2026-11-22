import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { priorityLabel, summarizeLeads } from "./lead-summary";

describe("lead summary", () => {
  test("uses the existing priority boundaries", () => {
    assert.deepEqual([null, 0, 29, 30, 59, 60, 100].map(priorityLabel),
      ["Baja", "Baja", "Baja", "Media", "Media", "Alta", "Alta"]);
  });
  test("counts phase, priority and missing zones from actual rows", () => {
    const summary = summarizeLeads([
      { phase: "FASE_0_14", score: 60, zone: " Centro " },
      { phase: "FASE_0_14", score: 30, zone: "Centro" },
      { phase: "FASE_46_90", score: 0, zone: null },
    ]);
    assert.deepEqual(summary.phases.map((row) => row.count), [2, 0, 1]);
    assert.deepEqual(summary.priorities.map((row) => row.count), [1, 1, 1]);
    assert.deepEqual(summary.zones, [{ label: "Centro", count: 2 }, { label: "Sin zona", count: 1 }]);
  });
  test("retains every lead when combining less frequent zones", () => {
    const summary = summarizeLeads(Array.from({ length: 8 }, (_, i) => ({
      phase: "FASE_15_45", score: 0, zone: `Zona ${i}`,
    })));
    assert.equal(summary.zones.length, 6);
    assert.deepEqual(summary.zones.at(-1), { label: "Otras zonas", count: 3 });
    assert.equal(summary.zones.reduce((sum, row) => sum + row.count, 0), 8);
  });
  test("does not invent rows when empty", () => {
    const summary = summarizeLeads([]);
    assert.deepEqual(summary.phases.map((row) => row.count), [0, 0, 0]);
    assert.deepEqual(summary.priorities.map((row) => row.count), [0, 0, 0]);
    assert.deepEqual(summary.zones, []);
  });
});