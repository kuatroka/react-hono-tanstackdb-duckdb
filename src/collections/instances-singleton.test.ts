import { describe, expect, test } from "bun:test";
import { allAssetsActivityCollection, assetsCollection } from "./instances";
import { allAssetsActivityCollection as exportedAllAssetsActivityCollection } from "./all-assets-activity";
import { assetsCollection as exportedAssetsCollection } from "./assets";

describe("collection singleton wiring", () => {
  test("assets collection module export points at shared instance", () => {
    expect(exportedAssetsCollection).toBe(assetsCollection);
    expect(exportedAssetsCollection).toBeDefined();
    expect(typeof exportedAssetsCollection.preload).toBe("function");
  });

  test("all-assets-activity collection module export points at shared instance", () => {
    expect(exportedAllAssetsActivityCollection).toBe(allAssetsActivityCollection);
    expect(exportedAllAssetsActivityCollection).toBeDefined();
    expect(typeof exportedAllAssetsActivityCollection.preload).toBe("function");
  });
});
