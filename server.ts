import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { db, pool } from "./src/db/index.ts";
import { users, productionReports, activityLogs } from "./src/db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config();

// Initialize Supabase Client if keys are available
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

if (supabase) {
  console.log("Supabase Client SDK berhasil terinisialisasi.");
} else {
  console.warn("Supabase Client SDK tidak aktif (menunggu SUPABASE_URL & SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY). Menggunakan fallback Drizzle/Postgres.");
}

// Database helper mappings to adapt between snake_case/camelCase dynamically
function mapReportFromDB(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    reportId: row.report_id !== undefined ? row.report_id : row.reportId,
    date: row.date,
    operator: row.operator,
    operatorUid: row.operator_uid !== undefined ? row.operator_uid : row.operatorUid,
    gallonsUsed: row.gallons_used !== undefined ? row.gallons_used : row.gallonsUsed,
    productionLiter: row.production_liter !== undefined ? row.production_liter : row.productionLiter,
    wastedLiter: row.wasted_liter !== undefined ? row.wasted_liter : row.wastedLiter,
    wastePercent: row.waste_percent !== undefined ? row.waste_percent : row.wastePercent,
    status: row.status,
    approved: row.approved,
    createdAt: row.created_at !== undefined ? row.created_at : row.createdAt,
  };
}

function mapUserFromDB(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at !== undefined ? row.created_at : row.createdAt,
  };
}

function mapLogFromDB(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    logId: row.log_id !== undefined ? row.log_id : (row.logId !== undefined ? row.logId : row.id),
    timestamp: row.timestamp || row.created_at,
    type: row.type,
    message: row.message,
    operator: row.operator,
    operatorUid: row.operator_uid !== undefined ? row.operator_uid : row.operatorUid,
  };
}

async function addActivityLog(type: string, message: string, operator: string, operatorUid?: string) {
  const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();
  
  const payload = {
    log_id: logId,
    timestamp,
    type,
    message,
    operator,
    operator_uid: operatorUid || null,
  };

  try {
    if (supabase) {
      const { error } = await supabase.from("activity_logs").insert([payload]);
      if (error) {
        // Fallback for camelCase
        const camelPayload = {
          logId,
          timestamp,
          type,
          message,
          operator,
          operatorUid: operatorUid || null,
        };
        await supabase.from("activity_logs").insert([camelPayload]);
      }
    } else {
      await db.insert(activityLogs).values({
        logId,
        timestamp: new Date(),
        type,
        message,
        operator,
        operatorUid: operatorUid || null,
      });
    }
    console.log(`Log berhasil disimpan: "${message}"`);
  } catch (err: any) {
    console.warn("Gagal menyimpan log aktivitas:", err.message);
  }
}

// Shared Gemini Client
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

// Helper function to handle Gemini API calls with retries and model fallbacks
async function generateContentWithRetryAndFallback(
  client: GoogleGenAI,
  params: { contents: any; config?: any },
  primaryModel: string = "gemini-3.5-flash",
  maxRetries = 3
): Promise<any> {
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    primaryModel,
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    let delay = 1000;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Mengirim permintaan ke model ${model} (Percobaan ${attempt + 1}/${maxRetries})...`);
        const response = await client.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errStr = String(err?.message || err);
        console.warn(`Gagal memanggil model ${model}:`, errStr);

        // Check if error is transient / retryable (503, 429, or network errors)
        const isRetryable =
          errStr.includes("503") ||
          errStr.includes("UNAVAILABLE") ||
          errStr.includes("429") ||
          errStr.includes("RESOURCE_EXHAUSTED") ||
          errStr.includes("fetch") ||
          errStr.includes("timeout") ||
          errStr.includes("temp") ||
          errStr.includes("demand") ||
          errStr.includes("overloaded");

        if (!isRetryable) {
          // If it is structural, we break and try the next model
          break;
        }

        if (attempt < maxRetries - 1) {
          console.log(`Menunggu ${delay}ms sebelum mencoba kembali...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5;
        }
      }
    }
    console.log(`Pindah ke model alternatif berikutnya karena ${model} gagal.`);
  }

  throw lastError || new Error("Gagal menghubungi semua model Gemini.");
}

async function initializeDatabase() {
  try {
    console.log("Memulai inisialisasi tabel database (jika belum ada)...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "uid" TEXT NOT NULL UNIQUE,
        "email" TEXT NOT NULL,
        "name" TEXT,
        "role" TEXT NOT NULL DEFAULT 'petugas',
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "production_reports" (
        "id" SERIAL PRIMARY KEY,
        "report_id" TEXT NOT NULL UNIQUE,
        "date" TEXT NOT NULL,
        "operator" TEXT NOT NULL,
        "operator_uid" TEXT NOT NULL,
        "gallons_used" INTEGER NOT NULL,
        "production_liter" INTEGER NOT NULL,
        "wasted_liter" INTEGER NOT NULL,
        "waste_percent" REAL NOT NULL,
        "status" TEXT NOT NULL,
        "approved" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" SERIAL PRIMARY KEY,
        "log_id" TEXT NOT NULL UNIQUE,
        "timestamp" TIMESTAMP DEFAULT NOW(),
        "type" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "operator" TEXT NOT NULL,
        "operator_uid" TEXT
      );
    `);
    console.log("Inisialisasi tabel database selesai dengan sukses.");
  } catch (err: any) {
    console.warn("Peringatan: Gagal melakukan inisialisasi tabel database otomatis:", err.message);
  }
}

export const app = express();

let dbInitialized = false;
async function ensureDatabase() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// Global middlewares
app.use(async (req, res, next) => {
  try {
    await ensureDatabase();
  } catch (err) {
    console.error("Gagal memastikan database terinisialisasi:", err);
  }
  next();
});

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

async function startServer() {
  const PORT = 3000;

  // --- DATABASE ROUTES (Directly on Supabase API Client / PostgreSQL) ---

  // 1. Fetch All Reports
  app.get("/api/reports", async (req, res) => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("production_reports")
          .select("*")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        return res.json((data || []).map(mapReportFromDB));
      } else {
        const sqlReports = await db.select().from(productionReports).orderBy(desc(productionReports.date), desc(productionReports.createdAt));
        res.json(sqlReports);
      }
    } catch (error) {
      console.error("Gagal memuat laporan dari Supabase:", error);
      res.status(500).json({ error: "Gagal memuat laporan dari database Supabase." });
    }
  });

  // 1b. Fetch All Activity Logs (from Supabase/PostgreSQL)
  app.get("/api/logs", async (req, res) => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("activity_logs")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(100);

        if (error) throw error;
        return res.json((data || []).map(mapLogFromDB));
      } else {
        const sqlLogs = await db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)).limit(100);
        res.json(sqlLogs);
      }
    } catch (error) {
      console.error("Gagal memuat log aktivitas dari Supabase:", error);
      res.status(500).json({ error: "Gagal memuat log aktivitas." });
    }
  });

  // 1c. Submit Custom Activity Log
  app.post("/api/logs", async (req, res) => {
    try {
      const { type, message, operator, operatorUid } = req.body;
      if (!type || !message || !operator) {
        res.status(400).json({ error: "Data log tidak lengkap" });
        return;
      }
      await addActivityLog(type, message, operator, operatorUid);
      res.json({ success: true });
    } catch (error) {
      console.error("Gagal menyimpan log aktivitas:", error);
      res.status(500).json({ error: "Gagal menyimpan log aktivitas." });
    }
  });

  // 2. Submit / Update Report
  app.post("/api/reports", async (req, res) => {
    try {
      const report = req.body;
      const { reportId, date, operator, operatorUid, gallonsUsed, productionLiter, wastedLiter, wastePercent, status, approved } = report;

      if (!reportId || !date || !operator) {
        res.status(400).json({ error: "Data laporan tidak lengkap" });
        return;
      }

      if (supabase) {
        // Check if report already exists for clean update behavior
        const { data: existing, error: findError } = await supabase
          .from("production_reports")
          .select("report_id, reportId")
          .or(`report_id.eq.${reportId},reportId.eq.${reportId}`)
          .maybeSingle();

        if (findError) {
          console.warn("Gagal mengecek laporan lama:", findError);
        }

        const payload = {
          report_id: reportId,
          date,
          operator,
          operator_uid: operatorUid,
          gallons_used: Number(gallonsUsed),
          production_liter: Number(productionLiter),
          wasted_liter: Number(wastedLiter),
          waste_percent: Number(wastePercent),
          status,
          approved: Boolean(approved),
          created_at: new Date().toISOString()
        };

        let queryError;
        if (existing) {
          const { error } = await supabase
            .from("production_reports")
            .update(payload)
            .or(`report_id.eq.${reportId},reportId.eq.${reportId}`);
          queryError = error;
        } else {
          const { error } = await supabase
            .from("production_reports")
            .insert([payload]);
          queryError = error;
        }

        if (queryError) {
          // Fallback: Try with camelCase property keys in case the DB table was constructed with camelCase columns
          const camelPayload = {
            reportId,
            date,
            operator,
            operatorUid,
            gallonsUsed: Number(gallonsUsed),
            productionLiter: Number(productionLiter),
            wastedLiter: Number(wastedLiter),
            wastePercent: Number(wastePercent),
            status,
            approved: Boolean(approved),
            createdAt: new Date().toISOString()
          };

          if (existing) {
            const { error: secondErr } = await supabase
              .from("production_reports")
              .update(camelPayload)
              .or(`report_id.eq.${reportId},reportId.eq.${reportId}`);
            if (secondErr) throw queryError;
          } else {
            const { error: secondErr } = await supabase
              .from("production_reports")
              .insert([camelPayload]);
            if (secondErr) throw queryError;
          }
        }

        // Simpan log aktivitas ke Supabase
        try {
          const formattedDate = date.split("-").reverse().join("/");
          if (existing) {
            await addActivityLog("info", `Laporan produksi harian (${formattedDate}) diperbarui oleh ${operator}.`, operator, operatorUid);
          } else {
            await addActivityLog("success", `Laporan produksi harian (${formattedDate}) dimasukkan oleh ${operator}.`, operator, operatorUid);
          }
          
          if (Number(wastePercent) > 10) {
            await addActivityLog("critical", `ALARM INDUSTRI: Rasio waste kritis terdeteksi pada ${formattedDate} sebesar ${Number(wastePercent).toFixed(1)}%!`, operator, operatorUid);
          } else if (Number(wastePercent) > 5) {
            await addActivityLog("warning", `PERINGATAN: Rasio waste melebihi batas 5% pada ${formattedDate} (${Number(wastePercent).toFixed(1)}%).`, operator, operatorUid);
          }
        } catch (logErr) {
          console.warn("Gagal membuat log aktivitas:", logErr);
        }

        res.json({ success: true, reportId });
      } else {
        const existingList = await db.select().from(productionReports).where(eq(productionReports.reportId, reportId)).limit(1);
        await db.insert(productionReports).values({
          reportId,
          date,
          operator,
          operatorUid,
          gallonsUsed: Number(gallonsUsed),
          productionLiter: Number(productionLiter),
          wastedLiter: Number(wastedLiter),
          wastePercent: Number(wastePercent),
          status,
          approved: Boolean(approved),
          createdAt: new Date(),
        }).onConflictDoUpdate({
          target: productionReports.reportId,
          set: {
            date,
            operator,
            operatorUid,
            gallonsUsed: Number(gallonsUsed),
            productionLiter: Number(productionLiter),
            wastedLiter: Number(wastedLiter),
            wastePercent: Number(wastePercent),
            status,
            approved: Boolean(approved),
          }
        });

        // Simpan log aktivitas ke local db fallback
        try {
          const formattedDate = date.split("-").reverse().join("/");
          if (existingList.length > 0) {
            await addActivityLog("info", `Laporan produksi harian (${formattedDate}) diperbarui oleh ${operator}.`, operator, operatorUid);
          } else {
            await addActivityLog("success", `Laporan produksi harian (${formattedDate}) dimasukkan oleh ${operator}.`, operator, operatorUid);
          }
          
          if (Number(wastePercent) > 10) {
            await addActivityLog("critical", `ALARM INDUSTRI: Rasio waste kritis terdeteksi pada ${formattedDate} sebesar ${Number(wastePercent).toFixed(1)}%!`, operator, operatorUid);
          } else if (Number(wastePercent) > 5) {
            await addActivityLog("warning", `PERINGATAN: Rasio waste melebihi batas 5% pada ${formattedDate} (${Number(wastePercent).toFixed(1)}%).`, operator, operatorUid);
          }
        } catch (logErr) {
          console.warn("Gagal membuat log aktivitas:", logErr);
        }

        res.json({ success: true, reportId });
      }
    } catch (error) {
      console.error("Gagal menyimpan laporan ke Supabase:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Gagal menyimpan laporan." });
    }
  });

  // 3. Approve Report
  app.put("/api/reports/:reportId/approve", async (req, res) => {
    try {
      const { reportId } = req.params;

      let reportDetails: any = null;
      if (supabase) {
        const { data } = await supabase
          .from("production_reports")
          .select("*")
          .or(`report_id.eq.${reportId},reportId.eq.${reportId}`)
          .maybeSingle();
        if (data) reportDetails = mapReportFromDB(data);
      } else {
        const rows = await db.select().from(productionReports).where(eq(productionReports.reportId, reportId)).limit(1);
        if (rows.length > 0) reportDetails = rows[0];
      }

      if (supabase) {
        const { error } = await supabase
          .from("production_reports")
          .update({ approved: true })
          .or(`report_id.eq.${reportId},reportId.eq.${reportId}`);

        if (error) throw error;
      } else {
        await db.update(productionReports).set({ approved: true }).where(eq(productionReports.reportId, reportId));
      }

      if (reportDetails) {
        const formattedDate = reportDetails.date.split("-").reverse().join("/");
        await addActivityLog("admin", `Laporan tanggal ${formattedDate} telah ditinjau dan diverifikasi oleh Administrator.`, "Administrator");
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Gagal melakukan persetujuan laporan di Supabase:", error);
      res.status(500).json({ error: "Gagal menyetujui laporan." });
    }
  });

  // 4. Delete Single Report
  app.delete("/api/reports/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;

      let reportDetails: any = null;
      if (supabase) {
        const { data } = await supabase
          .from("production_reports")
          .select("*")
          .or(`report_id.eq.${reportId},reportId.eq.${reportId}`)
          .maybeSingle();
        if (data) reportDetails = mapReportFromDB(data);
      } else {
        const rows = await db.select().from(productionReports).where(eq(productionReports.reportId, reportId)).limit(1);
        if (rows.length > 0) reportDetails = rows[0];
      }

      if (supabase) {
        const { error } = await supabase
          .from("production_reports")
          .delete()
          .or(`report_id.eq.${reportId},reportId.eq.${reportId}`);

        if (error) throw error;
      } else {
        await db.delete(productionReports).where(eq(productionReports.reportId, reportId));
      }

      if (reportDetails) {
        const formattedDate = reportDetails.date.split("-").reverse().join("/");
        await addActivityLog("warning", `Laporan harian (${formattedDate}) milik ${reportDetails.operator} telah dihapus oleh Administrator.`, "Administrator");
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Gagal menghapus laporan dari Supabase:", error);
      res.status(500).json({ error: "Gagal menghapus laporan." });
    }
  });

  // 5. Reset All Reports
  app.post("/api/reports/reset", async (req, res) => {
    try {
      if (supabase) {
        const { error } = await supabase
          .from("production_reports")
          .delete()
          .neq("date", "0000-00-00");

        if (error) {
          const { error: secondErr } = await supabase
            .from("production_reports")
            .delete()
            .neq("reportId", "does_not_exist");
          if (secondErr) throw error;
        }
      } else {
        await db.delete(productionReports);
      }

      await addActivityLog("critical", "Seluruh data laporan produksi harian telah di-reset oleh Administrator.", "Administrator");

      res.json({ success: true });
    } catch (error) {
      console.error("Gagal melakukan reset seluruh data laporan di Supabase:", error);
      res.status(500).json({ error: "Gagal mereset laporan." });
    }
  });

  // 6. Fetch All Users
  app.get("/api/users", async (req, res) => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        res.json((data || []).map(mapUserFromDB));
      } else {
        const sqlUsers = await db.select().from(users).orderBy(desc(users.createdAt));
        res.json(sqlUsers);
      }
    } catch (error) {
      console.error("Gagal mengambil daftar pengguna dari Supabase:", error);
      res.status(500).json({ error: "Gagal mengambil daftar pengguna." });
    }
  });

  // 6b. Fetch Single User Profile by UID
  app.get("/api/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;

      if (supabase) {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("uid", uid)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          res.status(404).json({ error: "Pengguna tidak ditemukan di database." });
          return;
        }
        res.json(mapUserFromDB(data));
      } else {
        const userList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
        if (userList.length === 0) {
          res.status(404).json({ error: "Pengguna tidak ditemukan di database." });
          return;
        }
        res.json(userList[0]);
      }
    } catch (error) {
      console.error("Gagal mengambil profil pengguna dari Supabase:", error);
      res.status(500).json({ error: "Gagal mengambil profil pengguna." });
    }
  });

  // 7. Upsert User
  app.post("/api/users", async (req, res) => {
    try {
      const profile = req.body;
      const { uid, email, name, role } = profile;

      if (!uid || !email) {
        res.status(400).json({ error: "Data pengguna tidak lengkap" });
        return;
      }

      if (supabase) {
        const { data: existing, error: findError } = await supabase
          .from("users")
          .select("uid")
          .eq("uid", uid)
          .maybeSingle();

        if (findError) {
          console.warn("Gagal mengecek user lama:", findError);
        }

        const payload = {
          uid,
          email,
          name,
          role: role || "petugas",
          created_at: new Date().toISOString()
        };

        let queryError;
        if (existing) {
          const { error } = await supabase
            .from("users")
            .update(payload)
            .eq("uid", uid);
          queryError = error;
        } else {
          const { error } = await supabase
            .from("users")
            .insert([payload]);
          queryError = error;
        }

        if (queryError) {
          const camelPayload = {
            uid,
            email,
            name,
            role: role || "petugas",
            createdAt: new Date().toISOString()
          };
          if (existing) {
            const { error: secondErr } = await supabase
              .from("users")
              .update(camelPayload)
              .eq("uid", uid);
            if (secondErr) throw queryError;
          } else {
            const { error: secondErr } = await supabase
              .from("users")
              .insert([camelPayload]);
            if (secondErr) throw queryError;
          }
        }
        if (!existing) {
          try {
            await addActivityLog("admin", `Pengguna baru ${name || email} mendaftar sebagai ${role || 'petugas'}.`, name || email, uid);
          } catch (logErr) {
            console.warn("Gagal membuat log pendaftaran user baru:", logErr);
          }
        }
        res.json({ success: true, uid });
      } else {
        const existingList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
        await db.insert(users).values({
          uid,
          email,
          name,
          role: role || "petugas",
          createdAt: new Date(),
        }).onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
            name,
            role: role || "petugas",
          }
        });

        if (existingList.length === 0) {
          try {
            await addActivityLog("admin", `Pengguna baru ${name || email} mendaftar sebagai ${role || 'petugas'}.`, name || email, uid);
          } catch (logErr) {
            console.warn("Gagal membuat log pendaftaran user baru:", logErr);
          }
        }
        res.json({ success: true, uid });
      }
    } catch (error) {
      console.error("Gagal menyimpan profil pengguna ke Supabase:", error);
      res.status(500).json({ error: "Gagal menyimpan profil pengguna." });
    }
  });

  // 7b. Update User Role
  app.put("/api/users/:uid/role", async (req, res) => {
    try {
      const { uid } = req.params;
      const { role } = req.body;

      if (!uid || !role) {
        res.status(400).json({ error: "UID dan Role harus ditentukan" });
        return;
      }

      let userDetails: any = null;
      if (supabase) {
        const { data } = await supabase.from("users").select("*").eq("uid", uid).maybeSingle();
        if (data) userDetails = mapUserFromDB(data);
      } else {
        const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
        if (rows.length > 0) userDetails = rows[0];
      }

      if (supabase) {
        const { error } = await supabase
          .from("users")
          .update({ role })
          .eq("uid", uid);

        if (error) throw error;
      } else {
        await db.update(users).set({ role }).where(eq(users.uid, uid));
      }

      if (userDetails) {
        try {
          await addActivityLog("admin", `Hak akses pengguna ${userDetails.name || userDetails.email} diubah menjadi ${role}.`, "Administrator");
        } catch (logErr) {
          console.warn("Gagal membuat log update role:", logErr);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Gagal memperbarui peran pengguna di Supabase:", error);
      res.status(500).json({ error: "Gagal memperbarui peran pengguna." });
    }
  });

  // 7c. Delete User
  app.delete("/api/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;

      if (supabase) {
        const { error } = await supabase
          .from("users")
          .delete()
          .eq("uid", uid);

        if (error) throw error;
        res.json({ success: true });
      } else {
        await db.delete(users).where(eq(users.uid, uid));
        res.json({ success: true });
      }
    } catch (error) {
      console.error("Gagal menghapus pengguna dari Supabase:", error);
      res.status(500).json({ error: "Gagal menghapus pengguna." });
    }
  });

  // API Route for DMAIC Analysis
  app.post("/api/dmaic", async (req, res) => {
    try {
      const { productionData } = req.body;
      if (!productionData || !Array.isArray(productionData)) {
        res.status(400).json({ error: "Invalid production data provided" });
        return;
      }

      // Formulate data summary for the AI model
      const totalProduction = productionData.reduce((sum, r) => sum + (r.productionLiter || 0), 0);
      const totalWasted = productionData.reduce((sum, r) => sum + (r.wastedLiter || 0), 0);
      const overallWastePercent = totalProduction > 0 ? (totalWasted / totalProduction) * 100 : 0;

      const operatorStats = productionData.reduce((acc, r) => {
        const op = r.operator || "Unknown";
        if (!acc[op]) acc[op] = { production: 0, wasted: 0 };
        acc[op].production += (r.productionLiter || 0);
        acc[op].wasted += (r.wastedLiter || 0);
        return acc;
      }, {} as Record<string, { production: number; wasted: number }>);

      const worstOperator = (Object.entries(operatorStats) as [string, { production: number; wasted: number }][]).reduce((worst, [name, stats]) => {
        const pct = stats.production > 0 ? (stats.wasted / stats.production) * 100 : 0;
        if (pct > worst.pct) {
          return { name, pct };
        }
        return worst;
      }, { name: "Tidak terdeteksi", pct: 0 });

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(400).json({ error: "GEMINI_API_KEY tidak dikonfigurasi di Settings > Secrets. Silakan hubungkan API Key Anda untuk mengaktifkan DAMIU Agent (Gemini AI) secara langsung." });
        return;
      }

      try {
        const client = getGeminiClient();

        const opSummaryString = (Object.entries(operatorStats) as [string, { production: number; wasted: number }][])
          .map(([op, stat]) => {
            const pct = stat.production > 0 ? (stat.wasted / stat.production) * 100 : 0;
            return `- ${op}: Produksi ${stat.production.toFixed(0)}L, Terbuang ${stat.wasted.toFixed(0)}L (Waste: ${pct.toFixed(2)}%)`;
          })
          .join("\n");

        const recentLogsString = productionData
          .slice(-10)
          .map(r => `- Tanggal ${r.date}, Petugas: ${r.operator}, Galon: ${r.gallonsUsed}, Produksi: ${r.productionLiter}L, Terbuang: ${r.wastedLiter}L (Waste: ${r.wastePercent.toFixed(2)}%, Status: ${r.status})`)
          .join("\n");

        const prompt = `
Kamu adalah DAMIU Agent, asisten AI optimasi operasional cerdas untuk Air Minum Isi Ulang (DAMIU). 
Analisis data operasional riil DAMIU berikut dan hasilkan Laporan Analisis Riwayat Operasional yang sangat terperinci, formal, bersahabat, dan taktis dalam format JSON menggunakan bahasa Indonesia yang baik dan benar. 

DATA MONITORING PRODUKSI DAMIU:
- Total Produksi: ${totalProduction.toFixed(0)} Liter (dengan kapasitas produksi harian fix 589 Liter)
- Total Air Terbuang: ${totalWasted.toFixed(0)} Liter
- Rata-rata Persentase Pemborosan (Waste): ${overallWastePercent.toFixed(2)}%
- Target Batas Pemborosan Maksimum: 5%

Kinerja Berdasarkan Petugas:
${opSummaryString}

10 Riwayat Laporan Terakhir:
${recentLogsString}

Persyaratan Format Output:
Kembalikan respon HANYA berupa objek JSON murni dengan struktur berikut:
{
  "trendSummary": "Ringkasan tren operasional berdasarkan total produksi (${totalProduction.toFixed(0)}L) dan total air terbuang (${totalWasted.toFixed(0)}L). Sebutkan rasio pemborosan aktual (${overallWastePercent.toFixed(2)}%) dibanding target aman (5%), serta deskripsi singkat pola trennya.",
  "operatorAnalysis": "Analisis terperinci mengenai kontribusi dan kinerja masing-masing operator (terutama bandingkan ${worstOperator.name} dengan operator lainnya). Berikan ulasan mengapa ada variasi keterampilan dan tindakan pembinaan yang direkomendasikan.",
  "temporalPattern": "Ulasan tentang pola waktu dari riwayat, misalnya apakah pemborosan cenderung terjadi di hari kerja tertentu, atau saat volume galon harian sedang tinggi. Sebutkan insiden tanggal pemborosan air tertinggi yang terdeteksi dalam riwayat.",
  "actionableSteps": "Langkah perbaikan taktis yang langsung bisa diterapkan oleh pemilik DAMIU berdasarkan riwayat nyata di atas (seperti pembinaan petugas tertentu, standar waktu bilas, pengecekan berkala, dll).",
  "forecast": "Proyeksi dampak operasional jangka panjang (misal perkiraan total air terbuang dalam 30 hari ke depan jika pemborosan terus berlanjut, dan potensi penghematan jika ditekankan ke batas minimal)."
}
`;

        const aiResponse = await generateContentWithRetryAndFallback(client, {
          contents: prompt,
          config: {
            temperature: 0.3,
            maxOutputTokens: 1000,
            systemInstruction: "Kamu adalah asisten analitik taktis yang memberikan analisis super cepat, padat, ringkas, langsung pada poin operasional penting tanpa basa-basi atau kata pengantar panjang. Gunakan kalimat yang efisien, informatif, dan taktis dalam Bahasa Indonesia.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                trendSummary: {
                  type: Type.STRING,
                  description: "Ringkasan tren operasional berdasarkan total produksi dan total air terbuang, membandingkan rasio pemborosan aktual dengan target aman 5% serta pola trennya.",
                },
                operatorAnalysis: {
                  type: Type.STRING,
                  description: "Analisis terperinci mengenai kontribusi dan kinerja masing-masing operator. Ulasan variasi keterampilan dan rekomendasi tindakan pembinaan.",
                },
                temporalPattern: {
                  type: Type.STRING,
                  description: "Ulasan tentang pola waktu dari riwayat, seperti hari tertentu atau saat volume tinggi, serta insiden tanggal pemborosan air tertinggi.",
                },
                actionableSteps: {
                  type: Type.STRING,
                  description: "Langkah perbaikan taktis operasional air minum yang langsung bisa diterapkan berdasarkan data riwayat nyata.",
                },
                forecast: {
                  type: Type.STRING,
                  description: "Proyeksi dampak operasional jangka panjang (perkiraan air terbuang dalam 30 hari jika berlanjut, dan potensi penghematan jika ditekankan ke batas minimal).",
                },
              },
              required: ["trendSummary", "operatorAnalysis", "temporalPattern", "actionableSteps", "forecast"],
            }
          }
        }, "gemini-3.1-flash-lite", 2);

        const responseText = aiResponse.text;
        if (!responseText) {
          throw new Error("Empty response from Gemini API");
        }

        // Extract JSON in case there are markdown code blocks
        let jsonString = responseText.trim();
        if (jsonString.startsWith("```json")) {
          jsonString = jsonString.substring(7);
        }
        if (jsonString.startsWith("```")) {
          jsonString = jsonString.substring(3);
        }
        if (jsonString.endsWith("```")) {
          jsonString = jsonString.substring(0, jsonString.length - 3);
        }
        jsonString = jsonString.trim();

        const dmaicResult = JSON.parse(jsonString);
        res.json({
          ...dmaicResult,
          source: "gemini"
        });
      } catch (geminiError) {
        console.error("Gemini API call failed:", geminiError);
        const errMsg = geminiError instanceof Error ? geminiError.message : "Gagal terhubung dengan Gemini API.";
        res.status(500).json({
          error: `DAMIU Agent gagal menghubungi Gemini AI untuk melakukan analisis real-time: ${errMsg}`
        });
      }
    } catch (error) {
      console.error("DMAIC generation failed:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
    }
  });

  // API Route for Gallon Image Analysis
  app.post("/api/analyze-gallon", async (req, res) => {
    try {
      const { image, mimeType } = req.body;

      if (!image) {
        res.status(400).json({ error: "Silakan unggah atau pilih foto galon terlebih dahulu untuk dianalisis oleh DAMIU Agent." });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(400).json({ error: "GEMINI_API_KEY tidak dikonfigurasi di Settings > Secrets. Silakan hubungkan API Key Anda untuk mengaktifkan analisis gambar DAMIU Agent Gemini secara langsung." });
        return;
      }

      let base64Data = "";
      let activeMimeType = mimeType || "image/jpeg";

      if (image.startsWith("http")) {
        // Dynamic server-side download of the preset image to feed into the real Gemini Vision model
        try {
          const imgResponse = await fetch(image);
          if (!imgResponse.ok) {
            throw new Error(`Status: ${imgResponse.status}`);
          }
          const buffer = await imgResponse.arrayBuffer();
          base64Data = Buffer.from(buffer).toString("base64");
          activeMimeType = imgResponse.headers.get("content-type") || "image/jpeg";
        } catch (fetchErr: any) {
          res.status(500).json({
            error: `DAMIU Agent gagal mengunduh gambar contoh dari internet untuk dianalisis: ${fetchErr.message || fetchErr}`
          });
          return;
        }
      } else {
        base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      }

      try {
        const client = getGeminiClient();

        // Prepare the image part for Gemini
        const imagePart = {
          inlineData: {
            mimeType: activeMimeType,
            data: base64Data
          }
        };

        const prompt = `
Kamu adalah DAMIU Agent, konsultan kecerdasan buatan ahli kontrol kualitas dan keselamatan wadah pangan di industri Air Minum Isi Ulang (DAMIU) profesional.
Analisis foto galon yang diunggah berikut dan identifikasi masalahnya (misalnya apakah bocor, retak, tutup rusak/pecah, kotor/berlumut, penyok, kusam, atau masalah kebersihan lainnya).

Berikan analisis yang sangat terperinci, formal, bersahabat, dan taktis dalam bahasa Indonesia. Kembalikan respon HANYA berupa objek JSON murni dengan struktur berikut:
{
  "status": "Sukses",
  "issue": "Nama/identifikasi singkat masalah yang terlihat pada foto galon (gunakan istilah teknis bahasa Indonesia yang baik)",
  "severity": "Rendah" atau "Sedang" atau "Tinggi",
  "rootCause": "Penyebab utama dari kerusakan/masalah tersebut (mengapa hal itu bisa terjadi secara operasional)",
  "solution": "Langkah solusi konkret dan taktis yang harus diambil oleh pemilik DAMIU atau petugas untuk menangani galon ini sekarang",
  "prevention": "Tips pencegahan operasional di masa depan agar masalah serupa tidak terulang kembali"
}
`;

        const aiResponse = await generateContentWithRetryAndFallback(client, {
          contents: { parts: [imagePart, { text: prompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                status: {
                  type: Type.STRING,
                  description: "Harus selalu bernilai 'Sukses' jika gambar berhasil diidentifikasi.",
                },
                issue: {
                  type: Type.STRING,
                  description: "Nama atau identifikasi singkat masalah kerusakan/kebersihan yang terlihat pada foto galon.",
                },
                severity: {
                  type: Type.STRING,
                  description: "Tingkat keparahan masalah, harus salah satu dari: 'Rendah', 'Sedang', atau 'Tinggi'.",
                },
                rootCause: {
                  type: Type.STRING,
                  description: "Penyebab utama dari kerusakan/masalah tersebut secara operasional.",
                },
                solution: {
                  type: Type.STRING,
                  description: "Langkah solusi konkret dan taktis yang harus diambil sekarang oleh pemilik atau petugas untuk menangani galon ini.",
                },
                prevention: {
                  type: Type.STRING,
                  description: "Tips pencegahan operasional di masa depan agar masalah serupa tidak terulang kembali.",
                },
              },
              required: ["status", "issue", "severity", "rootCause", "solution", "prevention"],
            }
          }
        });

        const responseText = aiResponse.text;
        if (!responseText) {
          throw new Error("Empty response from Gemini API");
        }

        // Extract JSON
        let jsonString = responseText.trim();
        if (jsonString.startsWith("```json")) {
          jsonString = jsonString.substring(7);
        }
        if (jsonString.startsWith("```")) {
          jsonString = jsonString.substring(3);
        }
        if (jsonString.endsWith("```")) {
          jsonString = jsonString.substring(0, jsonString.length - 3);
        }
        jsonString = jsonString.trim();

        const analysisResult = JSON.parse(jsonString);
        res.json({
          ...analysisResult,
          source: "gemini"
        });
      } catch (geminiError) {
        console.error("Gemini image analysis failed:", geminiError);
        const errMsg = geminiError instanceof Error ? geminiError.message : "Gagal terhubung dengan Gemini API.";
        res.status(500).json({
          error: `DAMIU Agent gagal menghubungi Gemini AI untuk melakukan analisis gambar real-time: ${errMsg}`
        });
      }
    } catch (error) {
      console.error("Gallon analysis failed:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
    }
  });

  // Serve static assets or use Vite in dev mode
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

startServer();
