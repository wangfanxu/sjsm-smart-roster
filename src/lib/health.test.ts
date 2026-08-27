import { describe, expect, it } from "vitest";
import { createHealthPayload } from "./health";

describe("createHealthPayload", () => {
  it("returns a stable deployment health contract", () => {
    expect(createHealthPayload()).toEqual({
      service: "sjsm-smart-roster",
      status: "ok",
    });
  });
});
