import { describe, expect, it } from "vitest";
import type { JobId } from "../../src/board/job";
import {
  type ContractState,
  clearContract,
  getContract,
  setContract,
} from "../../src/state/contract";

describe("getContract", () => {
  it("returns { jobId } for a valid contract string", () => {
    const creep = { memory: { contract: "fill:extensions:ext1" } };
    const contract = getContract(creep);
    expect(contract).toEqual({ jobId: "fill:extensions:ext1" });
  });

  it("returns undefined when the contract field is missing", () => {
    const creep = { memory: {} };
    expect(getContract(creep)).toBeUndefined();
  });

  it("returns undefined for an unknown Job type", () => {
    const creep = { memory: { contract: "bogus:extensions:123" } };
    expect(getContract(creep)).toBeUndefined();
  });

  it("returns undefined for an unknown Node", () => {
    const creep = { memory: { contract: "fill:bogus:123" } };
    expect(getContract(creep)).toBeUndefined();
  });

  it("returns undefined for a missing separator", () => {
    const creep = { memory: { contract: "invalidJobId" } };
    expect(getContract(creep)).toBeUndefined();
  });

  it("returns undefined for an id with only one colon (fewer than 2 colons)", () => {
    const creep = { memory: { contract: "fill:extensions" } };
    expect(getContract(creep)).toBeUndefined();
  });

  it("returns undefined for a pre-migration two-segment contract string (AD-11 deploy compatibility)", () => {
    // Documents the exact shape any live Creep's Memory holds immediately after
    // this grammar change ships: the old `type:targetId` format degrades to "no
    // Contract" rather than being misread, so Matching reassigns the Creep fresh.
    const creep = { memory: { contract: "fill:spawn1" } };
    expect(getContract(creep)).toBeUndefined();
  });

  it("returns undefined for an empty targetId", () => {
    const creep = { memory: { contract: "mine:mines:" } };
    expect(getContract(creep)).toBeUndefined();
  });

  it("returns undefined when the contract field is null", () => {
    const creep = {
      memory: { contract: null as unknown as string | undefined },
    };
    expect(getContract(creep)).toBeUndefined();
  });

  it("returns undefined when the contract field is not a string", () => {
    const creep = {
      memory: { contract: 123 as unknown as string | undefined },
    };
    expect(getContract(creep)).toBeUndefined();
  });

  it("returns { jobId } for a targetId that contains a colon", () => {
    const creep = { memory: { contract: "fill:spawns:spawn:123" } };
    expect(getContract(creep)).toEqual({ jobId: "fill:spawns:spawn:123" });
  });

  it("returns undefined for an uppercase Job type", () => {
    const creep = { memory: { contract: "FILL:extensions:ext1" } };
    expect(getContract(creep)).toBeUndefined();
  });
});

describe("setContract", () => {
  it("writes the expected Job id string to memory.contract", () => {
    const creep: { memory: { contract?: string } } = { memory: {} };
    const contract: ContractState = { jobId: "build:build:site7" };
    setContract(creep, contract);
    expect(creep.memory.contract).toBe("build:build:site7");
  });

  it("round-trips through getContract", () => {
    const creep: { memory: { contract?: string } } = { memory: {} };
    const original: ContractState = { jobId: "upgrade:upgrade:controller1" };
    setContract(creep, original);
    expect(getContract(creep)).toEqual(original);
  });

  it("throws when given a malformed jobId", () => {
    const creep: { memory: { contract?: string } } = { memory: {} };
    const contract: ContractState = {
      jobId: "bogus:mines:123" as unknown as JobId,
    };
    expect(() => setContract(creep, contract)).toThrow(/unknown Job type/);
  });
});

describe("clearContract", () => {
  it("removes the contract so getContract returns undefined", () => {
    const creep = { memory: { contract: "mine:mines:source1" } };
    clearContract(creep);
    expect(creep.memory.contract).toBeUndefined();
    expect(getContract(creep)).toBeUndefined();
  });
});
