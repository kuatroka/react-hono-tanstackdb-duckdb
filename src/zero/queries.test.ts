import { describe, expect, test } from "bun:test";
import { queries } from "./queries";

describe("queries", () => {
  test("defines investor activity queries", () => {
    expect(typeof queries.investorActivityByCusip).toBe("function");
    expect(typeof queries.investorActivityByTicker).toBe("function");
    expect(queries.investorActivityByCusip("05330T205")).toBeTruthy();
    expect(queries.investorActivityByTicker("AMIX")).toBeTruthy();
  });
});
