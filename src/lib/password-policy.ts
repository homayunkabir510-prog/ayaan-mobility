export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export function isBcryptPasswordLengthValid(password: string): boolean {
  return new TextEncoder().encode(password).byteLength <= BCRYPT_MAX_PASSWORD_BYTES;
}
