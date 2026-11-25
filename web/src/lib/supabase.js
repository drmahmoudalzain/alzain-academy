import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const notConfigured = () => ({
  data: null,
  error: new Error("Supabase غير مهيأ: أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في web/.env"),
});

// لا نوقف تحميل الصفحة إذا لم تُضبط متغيرات البيئة؛ هذا يُبقي أزرار المعاينة
// وواجهة الدخول تعمل، بينما تُرجع عمليات المصادقة/البيانات خطأ إعداد واضح.
const missingClient = {
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => notConfigured(),
    signOut: async () => ({ error: null }),
  },
  rpc: async () => notConfigured(),
  from: () => {
    throw new Error("Supabase غير مهيأ: أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في web/.env");
  },
};

if (!url || !anonKey) {
  console.warn("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY غير معرّفان في web/.env — وضع الواجهة/المعاينة فقط.");
}

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : missingClient;
