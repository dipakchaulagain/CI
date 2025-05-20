import * as OTPAuth from "otpauth"

export function generateMfaSecret(): string {
  return OTPAuth.Secret.fromBase32(OTPAuth.Secret.generate()).base32
}

export function verifyTOTP(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: "ClientInventory",
    label: "User",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  })

  const delta = totp.validate({ token })
  return delta !== null
}

export function generateTOTPUri(secret: string, username: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "ClientInventory",
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  })

  return totp.toString()
}
