// تجزئة كلمات المرور بـ scrypt مع ملح فريد لكل مستخدم.
// الصيغ المدعومة للقراءة:
//   scrypt$N$r$p$saltHex$hashHex   (الصيغة الحالية)
//   s1$N$r$p$saltB64$hashB64       (صيغة البيانات التجريبية السابقة)
import crypto from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(normalize(password), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });
  return ["scrypt", N, R, P, salt.toString("hex"), key.toString("hex")].join("$");
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6) return false;

  const [scheme, n, r, p, saltPart, hashPart] = parts;

  try {
    let salt;
    let expected;

    if (scheme === "scrypt") {
      salt = Buffer.from(saltPart, "hex");
      expected = Buffer.from(hashPart, "hex");
    } else if (scheme === "s1") {
      salt = Buffer.from(saltPart, "base64");
      expected = Buffer.from(hashPart, "base64");
    } else {
      return false;
    }

    if (!salt.length || !expected.length) return false;

    const actual = crypto.scryptSync(normalize(password), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAX_MEM,
    });

    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function normalize(password) {
  return String(password ?? "").normalize("NFKC");
}
