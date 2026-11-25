// كاش خفيف للقراءات شبه الثابتة. المفاتيح مقيدة بالمستخدم الحالي،
// ولا تُخزَّن سوى القيم التي تمرّرها القائمة البيضاء في api.js.
const PREFIX = "az:cache:";
const DEFAULT_TTL = 60000;

let scope = "anon:";
const memory = new Map();
// قراءتان متزامنتان لنفس المفتاح تتشاركان نفس الطلب. تُعلَّم الدفعات الملغاة
// كي لا تعيد كتابة قيمة قديمة بعد إبطال الكاش.
const pending = new Map();

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
  const full = fullKey(key);
  const cached = read(full);
  if (cached !== undefined) return cached;

  const existing = pending.get(full);
  if (existing) return existing.promise;

  const entry = { promise: null, cancelled: false };
  entry.promise = (async () => {
    try {
      const value = await loader();
      // undefined يعني «لا تخزّن»؛ تستخدمه طبقة API للأخطاء المؤقتة.
      // إذا أُبطل الكاش أثناء الطلب فلا تُكتب النتيجة القديمة.
      if (!entry.cancelled && value !== undefined) {
        write(full, { v: value, exp: Date.now() + Math.max(0, ttl) });
      }
      return value;
    } finally {
      if (pending.get(full) === entry) pending.delete(full);
    }
  })();
  pending.set(full, entry);
  return entry.promise;
}

export function clear(prefix) {
  const match = prefix === undefined || prefix === null ? PREFIX : `${PREFIX}${prefix}`;
  for (const [key, entry] of [...pending]) {
    if (key.startsWith(match)) {
      entry.cancelled = true;
      pending.delete(key);
    }
  }
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
