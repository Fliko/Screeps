import { describe, expect, it } from "vitest";
import { chebyshevDistance } from "../../src/world/distance";

describe("chebyshevDistance", () => {
  it("returns 0 for the same position", () => {
    expect(chebyshevDistance({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });

  it("returns 1 for an orthogonally adjacent position", () => {
    expect(chebyshevDistance({ x: 10, y: 10 }, { x: 11, y: 10 })).toBe(1);
    expect(chebyshevDistance({ x: 10, y: 10 }, { x: 10, y: 9 })).toBe(1);
  });

  it("returns 1 for a diagonally adjacent position", () => {
    expect(chebyshevDistance({ x: 10, y: 10 }, { x: 11, y: 11 })).toBe(1);
    expect(chebyshevDistance({ x: 10, y: 10 }, { x: 9, y: 9 })).toBe(1);
  });

  it("returns max(|dx|, |dy|) for far apart positions", () => {
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 3, y: 5 })).toBe(5);
    expect(chebyshevDistance({ x: 7, y: 2 }, { x: 1, y: 10 })).toBe(8);
  });

  it("works with negative coordinates", () => {
    expect(chebyshevDistance({ x: -5, y: -3 }, { x: 2, y: 7 })).toBe(10);
  });
});
