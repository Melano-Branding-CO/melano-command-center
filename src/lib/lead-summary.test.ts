import { describe, expect, test } from "bun:test";
import { priorityLabel, summarizeLeads } from "./lead-summary";

describe("lead summary", () => {
  test("uses the existing priority boundaries", () => {
    expect([null, 0, 29, 30, 59, 60, 100].map(priorityLabel))
      .toEqual(["Baja", "Baja", "Baja", "Media", "Media", "Alta", "Alta"]);
  });
  test("counts phase, priority and missing zones from actual rows", () => {
    const summary = summarizeLeads([
      { phase: "FASE_0_14", score: 60, zone: " Centro " },
      { phase: "FASE_0_14", score: 30, zone: "Centro" },
      { phase: "FASE_46_90", score: 0, zone: null },
    ]);
    expect(summary.phases.map((row) => row.count)).toEqual([2, 0, 1]);
    expect(summary.priorities.map((row) => row.count)).toEqual([1, 1, 1]);
    expect(summary.zones).toEqual([{ label: "Centro", count: 2 }, { label: "Sin zona", count: 1 }]);
  });
  test("retains every lead when combining less frequent zones", () => {
    const summary = summarizeLeads(Array.from({ length: 8 }, (_, i) => ({
      phase: "FASE_15_45", score: 0, zone: `Zona ${i}`,
    })));
    expect(summary.zones).toHaveLength(6);
    expect(summary.zones.at(-1)).toEqual({ label: "Otras zonas", count: 3 });
    expect(summary.zones.reduce((sum, row) => sum + row.count, 0)).toBe(8);
  });
  test("does not invent rows when empty", () => {
    const summary = summarizeLeads([]);
    expect(summary.phases.map((row) => row.count)).toEqual([0, 0, 0]);
    expect(summary.priorities.map((row) => row.count)).toEqual([0, 0, 0]);
    expect(summary.zones).toEqual([]);
  });
});