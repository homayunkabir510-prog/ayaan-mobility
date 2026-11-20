export type EvidenceKind = "start-odometer" | "end-odometer" | "expense-receipt";
export type EvidenceExtension = "jpg" | "png" | "webp";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

export function evidenceObjectPrefix(ownerUserId: string, kind: EvidenceKind, recordId: string): string {
  return `${ownerUserId}/${kind}/${recordId}/`;
}

export function makeEvidenceObjectKey(
  ownerUserId: string,
  kind: EvidenceKind,
  recordId: string,
  objectId: string,
  extension: EvidenceExtension
): string {
  if (!UUID_PATTERN.test(ownerUserId) || !UUID_PATTERN.test(recordId) || !UUID_PATTERN.test(objectId)) {
    throw new Error("Evidence paths require UUID owner, record, and object identifiers.");
  }
  return `${evidenceObjectPrefix(ownerUserId, kind, recordId)}${objectId}.${extension}`;
}

export function isEvidenceObjectForRecord(
  objectKey: string,
  ownerUserId: string,
  kind: EvidenceKind,
  recordId: string
): boolean {
  if (!UUID_PATTERN.test(ownerUserId) || !UUID_PATTERN.test(recordId)) return false;
  const prefix = evidenceObjectPrefix(ownerUserId, kind, recordId);
  if (!objectKey.startsWith(prefix)) return false;
  return FILE_PATTERN.test(objectKey.slice(prefix.length));
}
