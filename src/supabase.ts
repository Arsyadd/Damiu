import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || (typeof process !== "undefined" ? process.env.SUPABASE_URL : "") || "";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY : "") || "";

// Gunakan placeholder jika key belum dimasukkan oleh pengguna untuk mencegah crash aplikasi
const finalUrl = supabaseUrl && supabaseUrl.startsWith("http") ? supabaseUrl : "https://placeholder-project.supabase.co";
const finalKey = supabaseAnonKey || "placeholder-anon-key";

export const supabase = createClient(finalUrl, finalKey);

export const hasSupabaseKeys = () => {
  return !!supabaseUrl && !!supabaseAnonKey && !supabaseUrl.includes("placeholder-project");
};
