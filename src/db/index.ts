import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.ts';
import dotenv from 'dotenv';

// Pastikan dotenv dimuat sebelum membaca environment variables
dotenv.config();

export const createPool = () => {
  const connectionString = 
    process.env.DATABASE_URL || 
    process.env.SUPABASE_DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL;
  if (connectionString) {
    try {
      const trimmed = connectionString.trim();
      if (trimmed.startsWith("postgres://") || trimmed.startsWith("postgresql://")) {
        // Validasi menggunakan parser URL bawaan Node.js
        const url = new URL(trimmed);
        console.log(`Database pool terinisialisasi menggunakan URL (host: ${url.hostname})`);
        return new Pool({
          connectionString: trimmed,
          ssl: trimmed.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 15000,
        });
      } else {
        console.warn("DATABASE_URL tidak menggunakan protokol postgres:// atau postgresql://");
      }
    } catch (err: any) {
      console.error("Format DATABASE_URL tidak valid atau tidak bisa di-parse:", err.message);
    }
  }

  // Fallback ke Cloud SQL jika dikonfigurasi
  const host = process.env.SQL_HOST;
  if (host) {
    console.log(`Database pool terinisialisasi menggunakan parameter Cloud SQL (host: ${host})`);
    return new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      connectionTimeoutMillis: 15000,
    });
  }

  console.warn("Peringatan: Tidak ada konfigurasi database (DATABASE_URL / SQL_HOST) yang valid. Menggunakan dummy pool.");
  return new Pool({
    host: "127.0.0.1",
    port: 54321,
    connectionTimeoutMillis: 1000,
  });
};

export const pool = createPool();

pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

export const db = drizzle(pool, { schema });

