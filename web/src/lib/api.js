import { supabase } from "./supabase.js";

// عقد استدعاء موحّد. كل RPC يعيد { ok, data } أو { ok:false, error, code }.
export async function call(fn, params = {}) {
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
