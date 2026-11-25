// كاش خفيف للقراءات شبه الثابتة. المفاتيح مقيدة بالمستخدم الحالي،
// ولا تُخزَّن سوى القيم التي تمرّرها القائمة البيضاء في api.js.
const PREFIX = "az:cache:";
const DEFAULT_TTL = 60000;

let scope = "anon:";
const memory = new Map();

function session() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function fullKey(key) {
  return `${PREFIX}${scope}${key}`;
}

export function setCacheUser(id) {
  scope = id === null || id === undefined || id === "" ? "anon:" : `u${id}:`;
}

function write(full, entry) {
  memory.set(full, entry);
  try {
    session()?.setItem(full, JSON.stringify(entry));
  } catch {
    // قد يمتلئ sessionStorage أو يكون غير متاح؛ الذاكرة تكفي وحدها.
  }
}

function read(full) {
  const now = Date.now();
  const mem = memory.get(full);
  if (mem && mem.exp > now) return mem.v;
  if (mem) memory.delete(full);

  try {
    const raw = session()?.getItem(full);
    if (raw) {
      const entry = JSON.parse(raw);
      if (entry && entry.exp > now) {
        memory.set(full, entry);
        return entry.v;
      }
      session()?.removeItem(full);
    }
  } catch {
    // قيمة تالفة في sessionStorage تُهمَل بأمان.
  }
  return undefined;
}

export function set(key, value, ttl = DEFAULT_TTL) {
  write(fullKey(key), { v: value, exp: Date.now() + Math.max(0, ttl) });
  return value;
}

export function peek(key) {
  const value = read(fullKey(key));
  return value === undefined ? null : value;
}

export async function remember(key, ttl, loader) {
  const cached = read(fullKey(key));
  if (cached !== undefined) return cached;
  const value = await loader();
  // undefined يعني «لا تخزّن»؛ تستخدمه طبقة API للأخطاء المؤقتة.
  if (value !== undefined) set(key, value, ttl);
  return value;
}

export function clear(prefix) {
  const match = prefix === undefined || prefix === null ? PREFIX : `${PREFIX}${prefix}`;
  for (const key of [...memory.keys()]) {
    if (key.startsWith(match)) memory.delete(key);
  }
  const s = session();
  if (!s) return;
  try {
    for (let i = s.length - 1; i >= 0; i -= 1) {
      const key = s.key(i);
      if (key && key.startsWith(match)) s.removeItem(key);
    }
  } catch {
    // تجاهل أخطاء التخزين؛ الذاكرة طُهّرت بالفعل.
  }
}
