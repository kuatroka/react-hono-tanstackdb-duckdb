import { describe, expect, test } from "bun:test";
import { mapInvestorFlowRows } from "./investor-flow";

describe("mapInvestorFlowRows", () => {
  test("deduplicates duplicate quarter rows before writing them to the collection", () => {
    const rows = mapInvestorFlowRows("GBNK", [
      { quarter: "2013Q2", inflow: 10, outflow: 1 },
      { quarter: "2013Q2", inflow: 10, outflow: 1 },
      { quarter: "2013Q3", inflow: 12, outflow: 2 },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(["GBNK-2013Q2", "GBNK-2013Q3"]);
  });
});
