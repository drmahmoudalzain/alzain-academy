// عميل Supabase على الخادم فقط (service_role / secret key).
// لا يُستورد هذا الملف في أي كود يصل إلى المتصفح.
import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "alzain-academy-server" } },
});

export function assertOk(result, context) {
  if (result.error) {
    const message = result.error.message ?? String(result.error);
    const error = new Error(`${context}: ${message}`);
    error.cause = result.error;
    throw error;
  }
  return result.data;
}
