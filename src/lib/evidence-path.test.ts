import { describe, expect, it } from "vitest";
import { isEvidenceObjectForRecord, makeEvidenceObjectKey } from "./evidence-path";

const ownerId = "550e8400-e29b-41d4-a716-446655440000";
const dutyA = "550e8400-e29b-41d4-a716-446655440001";
const dutyB = "550e8400-e29b-41d4-a716-446655440002";
const objectId = "550e8400-e29b-41d4-a716-446655440003";

describe("evidence object path binding", () => {
  it("accepts an upload key only for its original driver, evidence kind, and duty", () => {
    const key = makeEvidenceObjectKey(ownerId, "expense-receipt", dutyA, objectId, "jpg");
    expect(isEvidenceObjectForRecord(key, ownerId, "expense-receipt", dutyA)).toBe(true);
    expect(isEvidenceObjectForRecord(key, ownerId, "expense-receipt", dutyB)).toBe(false);
    expect(isEvidenceObjectForRecord(key, "550e8400-e29b-41d4-a716-446655440004", "expense-receipt", dutyA)).toBe(false);
    expect(isEvidenceObjectForRecord(key, ownerId, "end-odometer", dutyA)).toBe(false);
  });

  it("rejects path traversal, extra path components, and non-UUID filenames", () => {
    const prefix = `${ownerId}/expense-receipt/${dutyA}/`;
    expect(isEvidenceObjectForRecord(`${prefix}../${objectId}.jpg`, ownerId, "expense-receipt", dutyA)).toBe(false);
    expect(isEvidenceObjectForRecord(`${prefix}nested/${objectId}.jpg`, ownerId, "expense-receipt", dutyA)).toBe(false);
    expect(isEvidenceObjectForRecord(`${prefix}receipt.jpg`, ownerId, "expense-receipt", dutyA)).toBe(false);
  });

  it("creates paths only from valid UUID identifiers", () => {
    expect(() => makeEvidenceObjectKey("not-an-id", "expense-receipt", dutyA, objectId, "jpg")).toThrow();
  });
});
