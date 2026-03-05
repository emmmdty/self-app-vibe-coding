import { describe, expect, it } from "vitest";

import { applyThemeColor } from "../../src/theme";

describe("theme", () => {
  it("applies css variables based on selected color", () => {
    const host = document.createElement("div");
    const applied = applyThemeColor("#3366FF", host);

    expect(applied).toBe("#3366ff");
    expect(host.style.getPropertyValue("--theme-color")).toBe("#3366ff");
    expect(host.style.getPropertyValue("--theme-color-strong")).toBe("#2952cc");
    expect(host.style.getPropertyValue("--theme-color-soft")).toContain("rgba(51, 102, 255");
  });

  it("falls back when color input is invalid", () => {
    const host = document.createElement("div");
    const applied = applyThemeColor("not-a-color", host);

    expect(applied).toBe("#2f80ed");
    expect(host.style.getPropertyValue("--theme-color")).toBe("#2f80ed");
  });
});
