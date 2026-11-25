const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTemporaryPassword() {
  const bytes = new Uint8Array(64);
  const password = [];
  const limit = 256 - (256 % ALPHABET.length);

  while (password.length < 12) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit) {
        password.push(ALPHABET[byte % ALPHABET.length]);
        if (password.length === 12) break;
      }
    }
  }

  return password.join("");
}

export async function invokeOwnerAdmin(payload, client) {
  const activeClient = client ?? (await import("./supabase.js")).supabase;
  if (typeof activeClient?.functions?.invoke !== "function") {
    return { ok: false, error: "Supabase Functions غير مهيأ" };
  }

  try {
    const { data, error } = await activeClient.functions.invoke("owner-user-admin", { body: payload });
    if (error) {
      return { ok: false, error: error.message || String(error) };
    }
    if (data && typeof data === "object" && "ok" in data) {
      return data;
    }
    return { ok: false, error: "استجابة غير متوقعة من خدمة الحسابات" };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}
