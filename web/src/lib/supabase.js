import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = "https://nsgahdnxpgctkljeusnp.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ2FoZG54cGdjdGtsamV1c25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5OTg2NjMsImV4cCI6MjExMDU3NDY2M30.9De9nZY5EFLYFOEkzxIqfuP5MFsQJPI56G58slC8TyM";

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});