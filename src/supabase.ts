import { createClient } from "@supabase/supabase-js";

const clean = (val: string) => {
  if (!val) return "";
  return val.replace(/\[/g, "").replace(/\]/g, "").trim();
};

const supabaseUrl = 
  (import.meta as any).env?.VITE_SUPABASE_URL || 
  (import.meta as any).env?.VITE_PUBLIC_SUPABASE_URL || 
  process.env.SUPABASE_URL || 
  "";

const supabaseAnonKey = 
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  (import.meta as any).env?.VITE_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  "";

const supabaseServiceKey = 
  (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  "";

const cleanedUrl = clean(supabaseUrl);
const cleanedAnonKey = clean(supabaseAnonKey);
const cleanedServiceKey = clean(supabaseServiceKey);

// Gunakan placeholder jika key belum dimasukkan oleh pengguna untuk mencegah crash aplikasi
const finalUrl = cleanedUrl && cleanedUrl.startsWith("http") ? cleanedUrl : "https://placeholder-project.supabase.co";
const finalKey = cleanedServiceKey || cleanedAnonKey || "placeholder-anon-key";

export const supabase = createClient(finalUrl, finalKey);

export const hasSupabaseKeys = () => {
  return !!cleanedUrl && !!cleanedAnonKey && !cleanedUrl.includes("placeholder-project");
};
