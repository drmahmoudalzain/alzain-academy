import { supabase } from "./supabase.js";
import { remember, clear } from "./cache.js";
import { isCacheable, isInvalidating, ttlFor } from "./cache-policy.js";

// عقد استدعاء موحّد. كل RPC يعيد { ok, data } أو { ok:false, error, code }.
async function rawCall(fn, params) {
  const { data, error } = await supabase.rpc(fn, params ?? {});
  if (error) {
    return { ok: false, error: error.message, code: error.code };
  }
  if (data && typeof data === "object" && "ok" in data) {
    if (data.ok === false) return { ok: false, error: data.error || "unknown", code: data.code };
    return { ok: true, data: data.data ?? data };
  }
  return { ok: true, data };
}

// مفتاح ثابت الترتيب حتى لا يتغير كاش نفس الاستدعاء بترتيب الخصائص.
function paramsKey(params) {
  const source = params ?? {};
  const sorted = Object.fromEntries(Object.keys(source).sort().map((k) => [k, source[k]]));
  return JSON.stringify(sorted);
}

export async function call(fn, params = {}) {
  // أي كتابة تُبطل كل النطاق قبل التنفيذ وبعد نجاحها: لوحة التحكم والإحصاءات
  // تعتمد على أكثر من RPC، وقد تبدأ قراءة أثناء تنفيذ الكتابة.
  if (isInvalidating(fn)) {
    clear();
    const res = await rawCall(fn, params);
    if (res.ok) clear();
    return res;
  }

  if (!isCacheable(fn)) return rawCall(fn, params);

  const key = `${fn}:${paramsKey(params)}`;
  let failure;
  const result = await remember(key, ttlFor(fn), async () => {
    const res = await rawCall(fn, params);
    if (!res.ok) {
      // الأخطاء المؤقتة لا تُخزَّن؛ تُعاد كما هي بعد انتهاء الدالة.
      failure = res;
      return undefined;
    }
    return res;
  });
  return failure ?? result;
}

// قراءة مباشرة محمية بـ RLS مع معالجة أخطاء شائعة.
export async function select(table, columns = "*", build) {
  let q = supabase.from(table).select(columns);
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) {
    if (error.code === "PGRST116") return { ok: true, data: [] };
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true, data: data ?? [] };
}

export function isMissingRpcError(e) {
  const code = e?.code || "";
  const msg = e?.message || e?.error || "";
  return code === "PGRST202" || /could not find the function|function .+ does not exist/i.test(msg);
}
