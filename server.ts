import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "data", "db.json");

// Ensure data folder and db.json exist
function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialDb = {
      reminders: [],
      config: {
        defaultRules: ["one_month_before", "one_week_before", "on_expiry"],
        categories: [
          "Payment Due",
          "Insurance",
          "Company Asset",
          "Employee Visa",
          "Software License",
          "AMC",
          "Compliance Certificate",
          "Vehicle Insurance",
          "Equipment Servicing",
          "Subscription"
        ],
        categoryRenewalPeriods: {
          "Insurance": "1 year",
          "EMI / Loan Repayment": "1 month",
          "Software License": "1 year",
          "AMC": "1 year",
          "Employee Visa": "1 year",
          "Compliance Certificate": "1 year",
          "Vehicle Insurance": "1 year",
          "Equipment Servicing": "6 months",
          "Subscription": "1 month",
          "Payment Due": "1 month",
          "Company Asset": "1 year"
        }
      },
      logs: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf8");
  }
}

ensureDb();

// Helper to read database
function readDb() {
  ensureDb();
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database:", err);
    return { reminders: [], config: {}, logs: [] };
  }
}

// Helper to write database
function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

// Supabase Database Integration
import pg from "pg";
const { Pool } = pg;
import { createClient } from "@supabase/supabase-js";

let pool: pg.Pool | null = null;
let supabaseClient: any = null;

function getSupabaseClient() {
  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey || url.trim() === "" || url.includes("YOUR_") || url.includes("MY_") || anonKey.trim() === "" || anonKey.includes("YOUR_") || anonKey.includes("MY_")) {
      return null;
    }
    // Check if url is a valid URL format to avoid throws
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      console.warn("[Supabase] Invalid SUPABASE_URL format:", url);
      return null;
    }
    if (!supabaseClient) {
      supabaseClient = createClient(url, anonKey);
    }
    return supabaseClient;
  } catch (err) {
    console.error("[Supabase] Failed to initialize Supabase client:", err);
    return null;
  }
}

function getPool(): pg.Pool | null {
  const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === "" || connectionString.includes("YOUR_") || connectionString.includes("MY_")) {
    return null;
  }
  if (connectionString.startsWith("http://") || connectionString.startsWith("https://")) {
    console.warn("[PostgreSQL] Connection string is an HTTP(S) URL. Rejecting to prevent hanging pg connections.");
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
    pool.on("error", (err) => {
      console.error("Unexpected error on idle pg client:", err);
    });
  }
  return pool;
}

// Check database connection and bootstrap tables asynchronously on-the-fly (for direct PG pooler)
async function runWithTimeout(promise: any, timeoutMs: number = 2500): Promise<any> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

let lastSupabaseFailureTime = 0;
let lastPostgresFailureTime = 0;
const BREAKER_COOLDOWN_MS = 60000; // 1 minute cooldown

function isSupabaseAvailable(): boolean {
  if (Date.now() - lastSupabaseFailureTime < BREAKER_COOLDOWN_MS) {
    return false;
  }
  return true;
}

function isPostgresAvailable(): boolean {
  if (Date.now() - lastPostgresFailureTime < BREAKER_COOLDOWN_MS) {
    return false;
  }
  return true;
}

function markSupabaseFailed() {
  lastSupabaseFailureTime = Date.now();
}

function markPostgresFailed() {
  lastPostgresFailureTime = Date.now();
}

let isBootstrapped = false;
async function ensureTables() {
  const p = getPool();
  if (!p || isBootstrapped || !isPostgresAvailable()) return;

  try {
    await runWithTimeout((async () => {
      const client = await p.connect();
      try {
        console.log("[Supabase] Connection verified. Initializing database schema...");
        
        // 1. Create CONFIG table
        await client.query(`
          CREATE TABLE IF NOT EXISTS config (
            key text PRIMARY KEY,
            "defaultRules" jsonb NOT NULL DEFAULT '["one_month_before", "one_week_before", "on_expiry"]'::jsonb,
            "categories" jsonb NOT NULL DEFAULT '[]'::jsonb,
            "categoryRenewalPeriods" jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        `);

        // 2. Create REMINDERS table
        await client.query(`
          CREATE TABLE IF NOT EXISTS reminders (
            id text PRIMARY KEY,
            "itemName" text NOT NULL,
            "category" text NOT NULL,
            "responsibleName" text NOT NULL,
            "responsibleEmail" text NOT NULL,
            "expiryDate" text NOT NULL,
            "renewalDate" text DEFAULT '',
            "status" text NOT NULL DEFAULT 'Active',
            "notes" text DEFAULT '',
            "rulesOverride" jsonb,
            "renewalHistory" jsonb DEFAULT '[]'::jsonb,
            "renewalPeriodOverride" text,
            "acknowledged" boolean DEFAULT false,
            "acknowledged_at" text DEFAULT null,
            "customer_name" text DEFAULT null,
            "customer_email" text DEFAULT null
          );
        `);

        // Ensure columns exist on existing reminders tables
        await client.query(`
          ALTER TABLE reminders ADD COLUMN IF NOT EXISTS "acknowledged" boolean DEFAULT false;
        `);
        await client.query(`
          ALTER TABLE reminders ADD COLUMN IF NOT EXISTS "acknowledged_at" text DEFAULT null;
        `);
        await client.query(`
          ALTER TABLE reminders ADD COLUMN IF NOT EXISTS "customer_name" text DEFAULT null;
        `);
        await client.query(`
          ALTER TABLE reminders ADD COLUMN IF NOT EXISTS "customer_email" text DEFAULT null;
        `);

        // 3. Create LOGS table
        await client.query(`
          CREATE TABLE IF NOT EXISTS logs (
            id text PRIMARY KEY,
            "reminderId" text NOT NULL,
            "reminderName" text NOT NULL,
            "recipientName" text NOT NULL,
            "recipientEmail" text NOT NULL,
            "triggerType" text NOT NULL,
            "triggerDate" text NOT NULL,
            "sentAt" text NOT NULL,
            "status" text NOT NULL,
            "errorDetail" text,
            "emailSubject" text NOT NULL,
            "emailBody" text NOT NULL,
            "recipientType" text DEFAULT null
          );
        `);

        // Ensure columns exist on existing logs tables
        await client.query(`
          ALTER TABLE logs ADD COLUMN IF NOT EXISTS "recipientType" text DEFAULT null;
        `);

        // 4. Seed default configuration
        await client.query(`
          INSERT INTO config (key, "defaultRules", "categories", "categoryRenewalPeriods")
          VALUES (
            'global',
            '["one_month_before", "one_week_before", "on_expiry"]'::jsonb,
            '["Payment Due", "Insurance", "Company Asset", "Employee Visa", "Software License", "AMC", "Compliance Certificate", "Vehicle Insurance", "Equipment Servicing", "Subscription"]'::jsonb,
            '{"Insurance": "1 year", "EMI / Loan Repayment": "1 month", "Software License": "1 year", "AMC": "1 year", "Employee Visa": "1 year", "Compliance Certificate": "1 year", "Vehicle Insurance": "1 year", "Equipment Servicing": "6 months", "Subscription": "1 month", "Payment Due": "1 month", "Company Asset": "1 year"}'::jsonb
          )
          ON CONFLICT (key) DO NOTHING;
        `);

        // Notify PostgREST to reload the schema cache so Supabase immediately picks up the new columns
        try {
          await client.query(`NOTIFY pgrst, 'reload schema';`);
          console.log("[Supabase] Notified PostgREST to reload schema cache successfully.");
        } catch (reloadErr) {
          console.warn("[Supabase] Could not notify PostgREST schema reload (non-fatal):", reloadErr);
        }

        isBootstrapped = true;
        console.log("[Supabase] Database tables and seed config created successfully.");
      } finally {
        client.release();
      }
    })(), 2500);
  } catch (err) {
    console.error("[Supabase] Error during database bootstrapper:", err);
    markPostgresFailed();
  }
}

// Database helper operations
async function getReminders(): Promise<any[]> {
  const s = getSupabaseClient();
  if (s && isSupabaseAvailable()) {
    try {
      const { data, error } = await runWithTimeout(s.from('reminders').select('*'), 2500);
      if (!error) {
        return data || [];
      }
      console.log("[Supabase Status] Fetching reminders: fallback activated (Info: " + (error?.message || JSON.stringify(error)) + ")");
      markSupabaseFailed();
    } catch (err) {
      console.log("[Supabase Status] Fetching reminders exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
      markSupabaseFailed();
    }
  }
  const p = getPool();
  if (!p || !isPostgresAvailable()) {
    return readDb().reminders || [];
  }
  try {
    await ensureTables();
    if (!isPostgresAvailable()) {
      return readDb().reminders || [];
    }
    const res = await runWithTimeout(p.query('SELECT * FROM reminders'), 2500);
    return res.rows;
  } catch (err) {
    console.log("[PostgreSQL Status] Fetching reminders exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
    markPostgresFailed();
    return readDb().reminders || [];
  }
}

async function getReminderById(id: string): Promise<any | null> {
  const s = getSupabaseClient();
  if (s && isSupabaseAvailable()) {
    try {
      const { data, error } = await runWithTimeout(s.from('reminders').select('*').eq('id', id).maybeSingle(), 2500);
      if (!error) {
        return data;
      }
      console.log("[Supabase Status] Fetching reminder by id: fallback activated (Info: " + (error?.message || JSON.stringify(error)) + ")");
      markSupabaseFailed();
    } catch (err) {
      console.log("[Supabase Status] Fetching reminder by id exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
      markSupabaseFailed();
    }
  }
  const p = getPool();
  if (!p || !isPostgresAvailable()) {
    const db = readDb();
    return (db.reminders || []).find((r: any) => r.id === id) || null;
  }
  try {
    await ensureTables();
    if (!isPostgresAvailable()) {
      const db = readDb();
      return (db.reminders || []).find((r: any) => r.id === id) || null;
    }
    const res = await runWithTimeout(p.query('SELECT * FROM reminders WHERE id = $1', [id]), 2500);
    return res.rows[0] || null;
  } catch (err) {
    console.log("[PostgreSQL Status] Fetching reminder by id exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
    markPostgresFailed();
    const db = readDb();
    return (db.reminders || []).find((r: any) => r.id === id) || null;
  }
}

async function saveReminder(reminder: any, mode: 'insert' | 'update' | 'upsert' = 'insert'): Promise<void> {
  const s = getSupabaseClient();
  if (s && isSupabaseAvailable()) {
    try {
      const payload = {
        id: reminder.id,
        itemName: reminder.itemName,
        category: reminder.category,
        responsibleName: reminder.responsibleName,
        responsibleEmail: reminder.responsibleEmail,
        expiryDate: reminder.expiryDate,
        renewalDate: reminder.renewalDate || '',
        status: reminder.status || 'Active',
        notes: reminder.notes || '',
        rulesOverride: reminder.rulesOverride || null,
        renewalHistory: reminder.renewalHistory || [],
        renewalPeriodOverride: reminder.renewalPeriodOverride || null,
        acknowledged: reminder.acknowledged === true || reminder.acknowledged === 'true',
        acknowledged_at: reminder.acknowledged_at || reminder.acknowledgedAt || null,
        customer_name: reminder.customer_name || reminder.customerName || null,
        customer_email: reminder.customer_email || reminder.customerEmail || null
      };

      let query;
      if (mode === 'insert') {
        query = s.from('reminders').insert(payload);
      } else if (mode === 'update') {
        query = s.from('reminders').update(payload).eq('id', reminder.id);
      } else {
        query = s.from('reminders').upsert(payload);
      }

      const { error } = await runWithTimeout(query, 2500);
      if (error) {
        console.error("[Supabase Error] Saving reminder failed (mode: " + mode + "):", error);
        throw new Error(`Supabase Error: ${error.message} (Code: ${error.code})${error.hint ? '. Hint: ' + error.hint : ''}`);
      }
      return;
    } catch (err) {
      console.error("[Supabase Status] Saving reminder exception:", err);
      throw err;
    }
  }
  const p = getPool();
  if (!p || !isPostgresAvailable()) {
    const db = readDb();
    db.reminders = db.reminders || [];
    const index = db.reminders.findIndex((r: any) => r.id === reminder.id);
    if (index !== -1) {
      db.reminders[index] = reminder;
    } else {
      db.reminders.push(reminder);
    }
    writeDb(db);
    return;
  }
  try {
    await ensureTables();
    if (!isPostgresAvailable()) {
      const db = readDb();
      db.reminders = db.reminders || [];
      const index = db.reminders.findIndex((r: any) => r.id === reminder.id);
      if (index !== -1) {
        db.reminders[index] = reminder;
      } else {
        db.reminders.push(reminder);
      }
      writeDb(db);
      return;
    }
    await runWithTimeout(p.query(`
      INSERT INTO reminders (
        id, "itemName", category, "responsibleName", "responsibleEmail", 
        "expiryDate", "renewalDate", status, notes, "rulesOverride", 
        "renewalHistory", "renewalPeriodOverride", acknowledged, "acknowledged_at",
        "customer_name", "customer_email"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        "itemName" = EXCLUDED."itemName",
        category = EXCLUDED.category,
        "responsibleName" = EXCLUDED."responsibleName",
        "responsibleEmail" = EXCLUDED."responsibleEmail",
        "expiryDate" = EXCLUDED."expiryDate",
        "renewalDate" = EXCLUDED."renewalDate",
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        "rulesOverride" = EXCLUDED."rulesOverride",
        "renewalHistory" = EXCLUDED."renewalHistory",
        "renewalPeriodOverride" = EXCLUDED."renewalPeriodOverride",
        acknowledged = EXCLUDED.acknowledged,
        "acknowledged_at" = EXCLUDED."acknowledged_at",
        "customer_name" = EXCLUDED."customer_name",
        "customer_email" = EXCLUDED."customer_email";
    `, [
      reminder.id,
      reminder.itemName,
      reminder.category,
      reminder.responsibleName,
      reminder.responsibleEmail,
      reminder.expiryDate,
      reminder.renewalDate || '',
      reminder.status || 'Active',
      reminder.notes || '',
      reminder.rulesOverride ? JSON.stringify(reminder.rulesOverride) : null,
      reminder.renewalHistory ? JSON.stringify(reminder.renewalHistory) : JSON.stringify([]),
      reminder.renewalPeriodOverride || null,
      reminder.acknowledged === true || reminder.acknowledged === 'true',
      reminder.acknowledged_at || reminder.acknowledgedAt || null,
      reminder.customer_name || reminder.customerName || null,
      reminder.customer_email || reminder.customerEmail || null
    ]), 2500);
  } catch (err) {
    console.log("[PostgreSQL Status] Saving reminder exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
    markPostgresFailed();
    const db = readDb();
    db.reminders = db.reminders || [];
    const index = db.reminders.findIndex((r: any) => r.id === reminder.id);
    if (index !== -1) {
      db.reminders[index] = reminder;
    } else {
      db.reminders.push(reminder);
    }
    writeDb(db);
  }
}

async function deleteReminder(id: string): Promise<boolean> {
  const s = getSupabaseClient();
  if (s && isSupabaseAvailable()) {
    try {
      const { error } = await runWithTimeout(s.from('reminders').delete().eq('id', id), 2500);
      if (!error) {
        return true;
      }
      console.log("[Supabase Status] Deleting reminder: fallback activated (Info: " + (error?.message || JSON.stringify(error)) + ")");
      markSupabaseFailed();
    } catch (err) {
      console.log("[Supabase Status] Deleting reminder exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
      markSupabaseFailed();
    }
  }
  const p = getPool();
  if (!p || !isPostgresAvailable()) {
    const db = readDb();
    const initialCount = (db.reminders || []).length;
    db.reminders = (db.reminders || []).filter((r: any) => r.id !== id);
    if (db.reminders.length < initialCount) {
      writeDb(db);
      return true;
    }
    return false;
  }
  try {
    await ensureTables();
    if (!isPostgresAvailable()) {
      const db = readDb();
      const initialCount = (db.reminders || []).length;
      db.reminders = (db.reminders || []).filter((r: any) => r.id !== id);
      if (db.reminders.length < initialCount) {
        writeDb(db);
        return true;
      }
      return false;
    }
    const res = await runWithTimeout(p.query('DELETE FROM reminders WHERE id = $1', [id]), 2500);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    console.log("[PostgreSQL Status] Deleting reminder exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
    markPostgresFailed();
    const db = readDb();
    const initialCount = (db.reminders || []).length;
    db.reminders = (db.reminders || []).filter((r: any) => r.id !== id);
    if (db.reminders.length < initialCount) {
      writeDb(db);
      return true;
    }
    return false;
  }
}

async function getConfig(): Promise<any> {
  const defaultConf = {
    defaultRules: ["one_month_before", "one_week_before", "on_expiry"],
    categories: [
      "Payment Due",
      "Insurance",
      "Company Asset",
      "Employee Visa",
      "Software License",
      "AMC",
      "Compliance Certificate",
      "Vehicle Insurance",
      "Equipment Servicing",
      "Subscription"
    ],
    categoryRenewalPeriods: {
      "Insurance": "1 year",
      "EMI / Loan Repayment": "1 month",
      "Software License": "1 year",
      "AMC": "1 year",
      "Employee Visa": "1 year",
      "Compliance Certificate": "1 year",
      "Vehicle Insurance": "1 year",
      "Equipment Servicing": "6 months",
      "Subscription": "1 month",
      "Payment Due": "1 month",
      "Company Asset": "1 year"
    }
  };

  const s = getSupabaseClient();
  if (s && isSupabaseAvailable()) {
    try {
      const { data, error } = await runWithTimeout(s.from('config').select('*').eq('key', 'global').maybeSingle(), 2500);
      if (!error && data) {
        return {
          defaultRules: data.defaultRules,
          categories: data.categories,
          categoryRenewalPeriods: data.categoryRenewalPeriods
        };
      }
      if (!error && !data) {
        // Key doesn't exist, seed it
        try {
          await runWithTimeout(s.from('config').insert({
            key: 'global',
            ...defaultConf
          }), 2500);
        } catch (e) {
          console.log("[Supabase Status] Note: Could not seed default configuration:", e);
        }
        return defaultConf;
      }
      console.log("[Supabase Status] Retrieving config: fallback activated (Info: " + (error?.message || JSON.stringify(error)) + ")");
      markSupabaseFailed();
    } catch (err) {
      console.log("[Supabase Status] Retrieving config exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
      markSupabaseFailed();
    }
  }

  const p = getPool();
  if (!p || !isPostgresAvailable()) {
    const db = readDb();
    const config = db.config || {};
    if (!config.categoryRenewalPeriods) {
      config.categoryRenewalPeriods = {
        "Insurance": "1 year",
        "EMI / Loan Repayment": "1 month",
        "Software License": "1 year",
        "AMC": "1 year",
        "Employee Visa": "1 year",
        "Compliance Certificate": "1 year",
        "Vehicle Insurance": "1 year",
        "Equipment Servicing": "6 months",
        "Subscription": "1 month",
        "Payment Due": "1 month",
        "Company Asset": "1 year"
      };
    }
    return config;
  }
  try {
    await ensureTables();
    if (!isPostgresAvailable()) {
      const db = readDb();
      const config = db.config || {};
      if (!config.categoryRenewalPeriods) {
        config.categoryRenewalPeriods = {
          "Insurance": "1 year",
          "EMI / Loan Repayment": "1 month",
          "Software License": "1 year",
          "AMC": "1 year",
          "Employee Visa": "1 year",
          "Compliance Certificate": "1 year",
          "Vehicle Insurance": "1 year",
          "Equipment Servicing": "6 months",
          "Subscription": "1 month",
          "Payment Due": "1 month",
          "Company Asset": "1 year"
        };
      }
      return config;
    }
    const res = await runWithTimeout(p.query("SELECT * FROM config WHERE key = 'global'"), 2500);
    if (res.rows.length > 0) {
      return {
        defaultRules: res.rows[0].defaultRules,
        categories: res.rows[0].categories,
        categoryRenewalPeriods: res.rows[0].categoryRenewalPeriods
      };
    }
    
    await runWithTimeout(p.query(`
      INSERT INTO config (key, "defaultRules", categories, "categoryRenewalPeriods")
      VALUES ('global', $1, $2, $3)
      ON CONFLICT (key) DO NOTHING;
    `, [JSON.stringify(defaultConf.defaultRules), JSON.stringify(defaultConf.categories), JSON.stringify(defaultConf.categoryRenewalPeriods)]), 2500);
    return defaultConf;
  } catch (err) {
    console.log("[PostgreSQL Status] Retrieving config exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
    markPostgresFailed();
    const db = readDb();
    const config = db.config || {};
    if (!config.categoryRenewalPeriods) {
      config.categoryRenewalPeriods = {
        "Insurance": "1 year",
        "EMI / Loan Repayment": "1 month",
        "Software License": "1 year",
        "AMC": "1 year",
        "Employee Visa": "1 year",
        "Compliance Certificate": "1 year",
        "Vehicle Insurance": "1 year",
        "Equipment Servicing": "6 months",
        "Subscription": "1 month",
        "Payment Due": "1 month",
        "Company Asset": "1 year"
      };
    }
    return config;
  }
}

async function saveConfig(config: any): Promise<void> {
  const s = getSupabaseClient();
  if (s && isSupabaseAvailable()) {
    try {
      const payload = {
        key: 'global',
        defaultRules: config.defaultRules,
        categories: config.categories,
        categoryRenewalPeriods: config.categoryRenewalPeriods
      };
      const { error } = await runWithTimeout(s.from('config').upsert(payload), 2500);
      if (!error) {
        return;
      }
      console.log("[Supabase Status] Saving config: fallback activated (Info: " + (error?.message || JSON.stringify(error)) + ")");
      markSupabaseFailed();
    } catch (err) {
      console.log("[Supabase Status] Saving config exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
      markSupabaseFailed();
    }
  }
  const p = getPool();
  if (!p || !isPostgresAvailable()) {
    const db = readDb();
    db.config = { ...db.config, ...config };
    writeDb(db);
    return;
  }
  try {
    await ensureTables();
    if (!isPostgresAvailable()) {
      const db = readDb();
      db.config = { ...db.config, ...config };
      writeDb(db);
      return;
    }
    await runWithTimeout(p.query(`
      INSERT INTO config (key, "defaultRules", categories, "categoryRenewalPeriods")
      VALUES ('global', $1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET
        "defaultRules" = EXCLUDED."defaultRules",
        categories = EXCLUDED.categories,
        "categoryRenewalPeriods" = EXCLUDED."categoryRenewalPeriods";
    `, [
      JSON.stringify(config.defaultRules),
      JSON.stringify(config.categories),
      JSON.stringify(config.categoryRenewalPeriods)
    ]), 2500);
  } catch (err) {
    console.log("[PostgreSQL Status] Saving config exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
    markPostgresFailed();
    const db = readDb();
    db.config = { ...db.config, ...config };
    writeDb(db);
  }
}

async function getLogs(): Promise<any[]> {
  const s = getSupabaseClient();
  if (s && isSupabaseAvailable()) {
    try {
      const { data, error } = await runWithTimeout(s.from('logs').select('*').order('sentAt', { ascending: false }), 2500);
      if (!error) {
        return data || [];
      }
      console.log("[Supabase Status] Fetching logs: fallback activated (Info: " + (error?.message || JSON.stringify(error)) + ")");
      markSupabaseFailed();
    } catch (err) {
      console.log("[Supabase Status] Fetching logs exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
      markSupabaseFailed();
    }
  }
  const p = getPool();
  if (!p || !isPostgresAvailable()) {
    return readDb().logs || [];
  }
  try {
    await ensureTables();
    if (!isPostgresAvailable()) {
      return readDb().logs || [];
    }
    const res = await runWithTimeout(p.query('SELECT * FROM logs ORDER BY "sentAt" DESC'), 2500);
    return res.rows;
  } catch (err) {
    console.log("[PostgreSQL Status] Fetching logs exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
    markPostgresFailed();
    return readDb().logs || [];
  }
}

async function saveLog(log: any): Promise<void> {
  const s = getSupabaseClient();
  if (s && isSupabaseAvailable()) {
    try {
      const payload = {
        id: log.id,
        reminderId: log.reminderId,
        reminderName: log.reminderName,
        recipientName: log.recipientName,
        recipientEmail: log.recipientEmail,
        triggerType: log.triggerType,
        triggerDate: log.triggerDate,
        sentAt: log.sentAt,
        status: log.status,
        errorDetail: log.errorDetail || null,
        emailSubject: log.emailSubject,
        emailBody: log.emailBody,
        recipientType: log.recipientType || 'responsible'
      };
      const { error } = await runWithTimeout(s.from('logs').insert(payload), 2500);
      if (!error) {
        return;
      }
      console.log("[Supabase Status] Saving log: fallback activated (Info: " + (error?.message || JSON.stringify(error)) + ")");
      markSupabaseFailed();
    } catch (err) {
      console.log("[Supabase Status] Saving log exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
      markSupabaseFailed();
    }
  }
  const p = getPool();
  if (!p || !isPostgresAvailable()) {
    const db = readDb();
    db.logs = [log, ...(db.logs || [])];
    writeDb(db);
    return;
  }
  try {
    await ensureTables();
    if (!isPostgresAvailable()) {
      const db = readDb();
      db.logs = [log, ...(db.logs || [])];
      writeDb(db);
      return;
    }
    await runWithTimeout(p.query(`
      INSERT INTO logs (
        id, "reminderId", "reminderName", "recipientName", "recipientEmail", 
        "triggerType", "triggerDate", "sentAt", status, "errorDetail", 
        "emailSubject", "emailBody", "recipientType"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
    `, [
      log.id,
      log.reminderId,
      log.reminderName,
      log.recipientName,
      log.recipientEmail,
      log.triggerType,
      log.triggerDate,
      log.sentAt,
      log.status,
      log.errorDetail || null,
      log.emailSubject,
      log.emailBody,
      log.recipientType || 'responsible'
    ]), 2500);
  } catch (err) {
    console.log("[PostgreSQL Status] Saving log exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
    markPostgresFailed();
    const db = readDb();
    db.logs = [log, ...(db.logs || [])];
    writeDb(db);
  }
}

async function clearLogs(): Promise<void> {
  const s = getSupabaseClient();
  if (s && isSupabaseAvailable()) {
    try {
      const { error } = await runWithTimeout(s.from('logs').delete().neq('id', ''), 2500);
      if (!error) {
        return;
      }
      console.log("[Supabase Status] Clearing logs: fallback activated (Info: " + (error?.message || JSON.stringify(error)) + ")");
      markSupabaseFailed();
    } catch (err) {
      console.log("[Supabase Status] Clearing logs exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
      markSupabaseFailed();
    }
  }
  const p = getPool();
  if (!p || !isPostgresAvailable()) {
    const db = readDb();
    db.logs = [];
    writeDb(db);
    return;
  }
  try {
    await ensureTables();
    if (!isPostgresAvailable()) {
      const db = readDb();
      db.logs = [];
      writeDb(db);
      return;
    }
    await runWithTimeout(p.query('DELETE FROM logs'), 2500);
  } catch (err) {
    console.log("[PostgreSQL Status] Clearing logs exception: fallback activated (Info: " + (err instanceof Error ? err.message : String(err)) + ")");
    markPostgresFailed();
    const db = readDb();
    db.logs = [];
    writeDb(db);
  }
}

// Middleware
app.use(express.json({ limit: "10mb" }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// Helper to calculate date differences and rule checking
function getDaysRemaining(expiryStr: string, targetStr: string): number {
  const expiry = new Date(expiryStr);
  const target = new Date(targetStr);
  // Clear times to compare dates only
  expiry.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - target.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function getOneMonthBefore(expiryStr: string): string {
  const [y, m, d] = expiryStr.split("-").map(Number);
  // Date handles month wrap automatically. Months are 0-indexed in JS.
  const date = new Date(y, m - 1 - 1, d);
  const targetY = date.getFullYear();
  const targetM = String(date.getMonth() + 1).padStart(2, "0");
  const targetD = String(date.getDate()).padStart(2, "0");
  return `${targetY}-${targetM}-${targetD}`;
}

function getOneWeekBefore(expiryStr: string): string {
  const [y, m, d] = expiryStr.split("-").map(Number);
  const date = new Date(y, m - 1, d - 7);
  const targetY = date.getFullYear();
  const targetM = String(date.getMonth() + 1).padStart(2, "0");
  const targetD = String(date.getDate()).padStart(2, "0");
  return `${targetY}-${targetM}-${targetD}`;
}

// Check rule match for a single reminder on a specific date
function checkRuleMatch(reminder: any, rule: string, targetStr: string): boolean {
  if (!reminder.expiryDate) return false;

  // If reminder is already expired and rule is not monthly or expiry itself, do not send noise
  const daysRemaining = getDaysRemaining(reminder.expiryDate, targetStr);

  switch (rule) {
    case "on_expiry":
      return reminder.expiryDate === targetStr;

    case "one_week_before":
      return getOneWeekBefore(reminder.expiryDate) === targetStr;

    case "one_month_before":
      return getOneMonthBefore(reminder.expiryDate) === targetStr;

    case "monthly_first":
      // Triggers on the 1st of every month if the item has not expired yet
      const isFirstOfMonth = targetStr.endsWith("-01");
      return isFirstOfMonth && daysRemaining >= 0 && reminder.status !== "Expired";

    default:
      return false;
  }
}

// Core function to check reminders and send emails
async function checkAndSendReminders(targetDateStr: string, triggerEmails = true) {
  const reminders = await getReminders();
  const config = await getConfig();
  const globalRules = config.defaultRules || ["one_month_before", "one_week_before", "on_expiry"];
  const disableSandboxRedirect = globalRules.includes("disable_sandbox_redirect");
  const activeGlobalRules = globalRules.filter((r: string) => r !== "disable_sandbox_redirect");
  const resendApiKey = process.env.RESEND_API_KEY;

  const matches: any[] = [];
  const newLogs: any[] = [];

  for (const reminder of reminders) {
    const daysRemaining = getDaysRemaining(reminder.expiryDate, targetDateStr);
    
    // Check if the item is OVERDUE (daysRemaining < 0) and not yet renewed/acknowledged
    // We send a daily repeat email for these until they are acknowledged.
    const isOverdue = daysRemaining < 0;
    const isActuallyOverdue = isOverdue && reminder.status !== "Renewed";
    const isAlreadyAcknowledged = reminder.acknowledged === true || reminder.acknowledged === 'true';

    if (isActuallyOverdue && !isAlreadyAcknowledged) {
      matches.push({ reminder, rule: "overdue_repeat", daysRemaining });
      continue; // Skip standard rule evaluation once overdue & repeating daily
    }

    // Only run standard rules for non-overdue items or already acknowledged overdue ones
    const rules = reminder.rulesOverride || activeGlobalRules;
    for (const rule of rules) {
      if (checkRuleMatch(reminder, rule, targetDateStr)) {
        matches.push({ reminder, rule, daysRemaining });
        break; // Ensure at most one match per day per reminder
      }
    }
  }

  if (matches.length === 0) {
    return { checked: reminders.length, sent: 0, matches: [] };
  }

  // Handle email sending
  for (const match of matches) {
    const { reminder, rule, daysRemaining } = match;
    
    // Consistent Subject Line Format as requested: "Reminder: [Item Name] — [Category] Expiry Alert"
    const subject = `Reminder: ${reminder.itemName} — ${reminder.category} Expiry Alert`;
    
    let ruleDesc = "";
    if (rule === "on_expiry") {
      ruleDesc = "Expires today!";
    } else if (rule === "one_week_before") {
      ruleDesc = "Expires in 7 days.";
    } else if (rule === "one_month_before") {
      ruleDesc = "Expires in 30 days.";
    } else if (rule === "monthly_first") {
      ruleDesc = `Monthly review reminder. Expires in ${daysRemaining} days.`;
    } else if (rule === "overdue_repeat") {
      ruleDesc = `OVERDUE DAILY ALERT: Expired on ${reminder.expiryDate} (${Math.abs(daysRemaining)} days ago).`;
    }

    const isOverdue = daysRemaining < 0;
    const remainingText = isOverdue 
      ? `<span style="color: #EF4444; font-weight: bold;">OVERDUE BY ${Math.abs(daysRemaining)} DAYS</span>`
      : `<span style="color: #F59E0B; font-weight: bold;">${daysRemaining} days remaining</span>`;

    const recipients: { name: string; email: string; isCustomer: boolean }[] = [
      {
        name: reminder.responsibleName,
        email: reminder.responsibleEmail,
        isCustomer: false
      }
    ];

    if ((reminder.customer_email || reminder.customerEmail) && (reminder.customer_email || reminder.customerEmail).trim()) {
      recipients.push({
        name: reminder.customer_name || reminder.customerName || "Customer",
        email: (reminder.customer_email || reminder.customerEmail).trim(),
        isCustomer: true
      });
    }

    for (const recipient of recipients) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${subject}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; padding: 20px; color: #1F2937; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
              <div style="background-color: #2563EB; padding: 24px; text-align: center;">
                <h1 style="color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em;">Obligation Reminder Alert</h1>
              </div>
              <div style="padding: 24px; line-height: 1.6;">
                <p style="margin-top: 0; font-size: 16px; color: #374151;">Hello <strong>${recipient.name}</strong>,</p>
                <p style="color: #4B5563;">This is an automated notification regarding a time-sensitive business obligation that requires your attention:</p>
                
                <div style="background-color: #F9FAFB; border: 1px solid #F3F4F6; border-left: 4px solid #2563EB; border-radius: 6px; padding: 18px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 4px 0; color: #6B7280; font-size: 14px; width: 35%;"><strong>Obligation:</strong></td>
                      <td style="padding: 4px 0; color: #111827; font-size: 14px;"><strong>${reminder.itemName}</strong></td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6B7280; font-size: 14px;"><strong>Category:</strong></td>
                      <td style="padding: 4px 0; color: #111827; font-size: 14px;">${reminder.category}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6B7280; font-size: 14px;"><strong>Expiry/Due Date:</strong></td>
                      <td style="padding: 4px 0; color: #111827; font-size: 14px; font-family: monospace;">${reminder.expiryDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6B7280; font-size: 14px;"><strong>Status:</strong></td>
                      <td style="padding: 4px 0; color: #111827; font-size: 14px;">${reminder.status}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6B7280; font-size: 14px;"><strong>Time Remaining:</strong></td>
                      <td style="padding: 4px 0; font-size: 14px;">${remainingText}</td>
                    </tr>
                    ${reminder.renewalDate ? `
                    <tr>
                      <td style="padding: 4px 0; color: #6B7280; font-size: 14px;"><strong>Renewal Date:</strong></td>
                      <td style="padding: 4px 0; color: #111827; font-size: 14px; font-family: monospace;">${reminder.renewalDate}</td>
                    </tr>
                    ` : ""}
                  </table>
                </div>

                ${reminder.notes ? `
                  <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 14px; color: #374151; margin-bottom: 6px;">Notes:</h3>
                    <p style="background-color: #F3F4F6; padding: 12px; border-radius: 6px; font-size: 13px; color: #4B5563; margin: 0; font-style: italic;">"${reminder.notes}"</p>
                  </div>
                ` : ""}

                ${rule === "overdue_repeat" ? `
                  <div style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 8px; padding: 18px; margin: 20px 0; text-align: center;">
                    <p style="margin-top: 0; font-size: 14px; color: #991B1B; font-weight: 600; margin-bottom: 10px;">⚠️ Overdue Action Required</p>
                    <p style="margin-top: 0; font-size: 13px; color: #7F1D1D; margin-bottom: 16px; line-height: 1.4;">This item is overdue. Please click the button below to acknowledge that you are handling this renewal.</p>
                    <a href="${process.env.APP_URL || "https://ais-dev-22mbj73dwbdzp3reaeb7hk-1020241534221.asia-southeast1.run.app"}/api/reminders/${reminder.id}/acknowledge" style="background-color: #EF4444; color: #FFFFFF; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 700; display: inline-block; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); text-transform: uppercase; letter-spacing: 0.025em;">Mark as Acknowledged</a>
                    <p style="margin-bottom: 0; font-size: 11px; color: #991B1B; margin-top: 10px; font-style: italic;">Acknowledging will stop daily repeat emails, but it will remain red on the dashboard.</p>
                  </div>
                ` : ""}

                <p style="color: #4B5563; font-size: 14px;">Please review this item and, if required, renew or update its details in the **Reminder & Expiry Manager** dashboard.</p>
                
                <div style="text-align: center; margin-top: 28px;">
                  <a href="${process.env.APP_URL || "https://ais-dev-22mbj73dwbdzp3reaeb7hk-1020241534221.asia-southeast1.run.app"}" style="background-color: #2563EB; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; display: inline-block; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">Open Expiry Manager</a>
                </div>

                <div style="margin-top: 24px; text-align: center; border-top: 1px dashed #E5E7EB; padding-top: 20px;">
                  <p style="font-size: 13px; color: #4B5563; margin-bottom: 12px; font-weight: 500;">Snooze this reminder:</p>
                  <div style="display: inline-flex; justify-content: center; gap: 8px;">
                    <a href="${process.env.APP_URL || "https://ais-dev-22mbj73dwbdzp3reaeb7hk-1020241534221.asia-southeast1.run.app"}/api/reminders/${reminder.id}/snooze?duration=1month" style="background-color: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; margin-right: 4px;">+1 Month</a>
                    <a href="${process.env.APP_URL || "https://ais-dev-22mbj73dwbdzp3reaeb7hk-1020241534221.asia-southeast1.run.app"}/api/reminders/${reminder.id}/snooze?duration=1week" style="background-color: #FEF3C7; color: #D97706; border: 1px solid #FDE68A; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block; margin-right: 4px;">+1 Week</a>
                    <a href="${process.env.APP_URL || "https://ais-dev-22mbj73dwbdzp3reaeb7hk-1020241534221.asia-southeast1.run.app"}/api/reminders/${reminder.id}/snooze?duration=1day" style="background-color: #F3F4F6; color: #4B5563; border: 1px solid #D1D5DB; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block;">+1 Day</a>
                  </div>
                </div>
              </div>
              <div style="background-color: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 16px; text-align: center; font-size: 12px; color: #9CA3AF;">
                This is an automated system notification. Please do not reply directly to this email.<br>
                Reminder Rule Triggered: <strong>${ruleDesc}</strong>
              </div>
            </div>
          </body>
        </html>
      `;

      let success = false;
      let errorDetail = "";

      let recipientEmailForResend = recipient.email;
      let isRedirected = false;

      // Sandbox Routing: To prevent Resend 403 (unverified recipient) errors, we route all unverified/mock
      // emails to the user's registered sandbox email address (pranavk.aconsultancy@gmail.com).
      if (!disableSandboxRedirect && recipientEmailForResend !== "pranavk.aconsultancy@gmail.com") {
        recipientEmailForResend = "pranavk.aconsultancy@gmail.com";
        isRedirected = true;
      }

      let finalEmailHtml = emailHtml;
      if (isRedirected) {
        const redirectBadge = `
          <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 12px; margin-bottom: 20px; text-align: left; font-size: 13px; color: #92400E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <strong>Sandbox Notice:</strong> This notification was originally addressed to <strong>${recipient.name}</strong> (&lt;${recipient.email}&gt;). It has been safely routed to <strong>pranavk.aconsultancy@gmail.com</strong> to comply with Resend Sandbox restrictions and ensure delivery.
          </div>
        `;
        finalEmailHtml = emailHtml.replace(
          `<div style="padding: 24px; line-height: 1.6;">`,
          `<div style="padding: 24px; line-height: 1.6;">${redirectBadge}`
        );
      }

      const isPlaceholderKey = !resendApiKey || resendApiKey === "MY_RESEND_API_KEY" || resendApiKey.trim() === "";

      if (triggerEmails && !isPlaceholderKey) {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: "Expiry Manager <onboarding@resend.dev>",
              to: [recipientEmailForResend],
              subject: subject,
              html: finalEmailHtml
            })
          });

          if (response.ok) {
            success = true;
            console.log(`Email successfully sent via Resend to ${recipientEmailForResend} (original: ${recipient.email}) for ${reminder.itemName}`);
          } else {
            const errRes = await response.json();
            errorDetail = JSON.stringify(errRes);
            console.error(`Resend API error: ${errorDetail}`);
          }
        } catch (err: any) {
          errorDetail = err.message || String(err);
          console.error(`Failed to send email to ${recipientEmailForResend}:`, err);
        }
      } else {
        // Simulate successful sending for preview & testing when key is missing/placeholder
        success = true;
        errorDetail = isPlaceholderKey 
          ? "Resend API simulated. [RESEND_API_KEY is missing or configured as placeholder in environment secrets. Configure a real key to send actual emails.]" 
          : "Email simulation triggered (dry-run mode).";
        console.log(`[SIMULATION] Email would be sent to ${recipientEmailForResend} (original: ${recipient.email}): Subject: "${subject}"`);
      }

      const logEntry = {
        id: "log-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5) + "-" + recipient.email.replace(/[^a-zA-Z0-9]/g, ""),
        reminderId: reminder.id,
        reminderName: reminder.itemName,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        triggerType: rule,
        triggerDate: targetDateStr,
        sentAt: new Date().toISOString(),
        status: success ? "success" : "failure",
        errorDetail: errorDetail || undefined,
        emailSubject: subject,
        emailBody: finalEmailHtml,
        recipientType: recipient.isCustomer ? "customer" : "responsible"
      };

      newLogs.push(logEntry);
    }
  }

  // Update DB logs
  for (const logEntry of newLogs) {
    await saveLog(logEntry);
  }

  return {
    checked: reminders.length,
    sent: newLogs.length,
    matches: matches.map(m => {
      let rec = m.reminder.responsibleEmail;
      const custEmail = m.reminder.customer_email || m.reminder.customerEmail;
      if (custEmail && custEmail.trim()) {
        rec += ` & ${custEmail.trim()}`;
      }
      return {
        itemName: m.reminder.itemName,
        recipient: rec,
        rule: m.rule,
        daysRemaining: m.daysRemaining
      };
    })
  };
}

// REST API Endpoints

// Acknowledge Overdue Reminder from email link
app.get("/api/reminders/:id/acknowledge", async (req, res) => {
  const id = req.params.id;
  try {
    const reminder = await getReminderById(id);
    if (!reminder) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Obligation Not Found</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #F3F4F6;
                color: #1F2937;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
              }
              .card {
                background-color: #FFFFFF;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                border: 1px solid #E5E7EB;
                padding: 32px;
                max-width: 480px;
                width: 100%;
                text-align: center;
              }
              h1 { font-size: 20px; color: #EF4444; margin-bottom: 12px; }
              p { font-size: 14px; color: #4B5563; line-height: 1.5; margin-bottom: 24px; }
              .btn { background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Obligation Not Found</h1>
              <p>We could not find the specified obligation. It might have been deleted or tracked under a different ID.</p>
              <a href="/" class="btn">Go to Dashboard</a>
            </div>
          </body>
        </html>
      `);
    }

    // Update reminder to be acknowledged
    const updated = {
      ...reminder,
      acknowledged: true,
      acknowledged_at: new Date().toISOString()
    };
    
    await saveReminder(updated, 'update');

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Obligation Acknowledged</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background-color: #F3F4F6;
              color: #1F2937;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
            .card {
              background-color: #FFFFFF;
              border-radius: 12px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              border: 1px solid #E5E7EB;
              padding: 32px;
              max-width: 480px;
              width: 100%;
              text-align: center;
            }
            .icon-success {
              color: #10B981;
              font-size: 48px;
              margin-bottom: 16px;
              display: inline-block;
            }
            h1 { font-size: 22px; color: #10B981; margin-bottom: 12px; font-weight: 600; }
            p { font-size: 14px; color: #4B5563; line-height: 1.5; margin-bottom: 24px; }
            .details-box {
              background-color: #F9FAFB;
              border: 1px solid #F3F4F6;
              border-radius: 6px;
              padding: 16px;
              margin-bottom: 24px;
              text-align: left;
            }
            .details-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 13px;
              border-bottom: 1px solid #F3F4F6;
            }
            .details-row:last-child {
              border-bottom: none;
            }
            .label { color: #6B7280; font-weight: 500; }
            .val { color: #111827; font-weight: 600; }
            .btn { background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; display: inline-block; transition: background-color 0.15s; }
            .btn:hover { background-color: #1D4ED8; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon-success">✓</div>
            <h1>Acknowledge Confirmation</h1>
            <p>Thanks, this has been marked as acknowledged.</p>
            
            <div class="details-box">
              <div class="details-row">
                <span class="label">Obligation Name:</span>
                <span class="val">${reminder.itemName}</span>
              </div>
              <div class="details-row">
                <span class="label">Category:</span>
                <span class="val">${reminder.category}</span>
              </div>
              <div class="details-row">
                <span class="label">Expiry Date:</span>
                <span class="val" style="font-family: monospace;">${reminder.expiryDate}</span>
              </div>
              <div class="details-row">
                <span class="label">Acknowledged By:</span>
                <span class="val">${reminder.responsibleName}</span>
              </div>
            </div>

            <a href="/" class="btn">Go to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Acknowledge error:", err);
    return res.status(500).send(`An error occurred: ${err.message || String(err)}`);
  }
});

// Snooze Reminder from email link
app.get("/api/reminders/:id/snooze", async (req, res) => {
  const id = req.params.id;
  const duration = req.query.duration as string; // '1month', '1week', '1day'
  
  const reminder = await getReminderById(id);
  if (!reminder) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Obligation Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background-color: #F3F4F6;
              color: #1F2937;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
            .card {
              background-color: #FFFFFF;
              border-radius: 12px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              border: 1px solid #E5E7EB;
              padding: 32px;
              max-width: 480px;
              width: 100%;
              text-align: center;
            }
            h1 { font-size: 20px; color: #EF4444; margin-bottom: 12px; }
            p { font-size: 14px; color: #4B5563; line-height: 1.5; margin-bottom: 24px; }
            .btn { background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Obligation Not Found</h1>
            <p>We could not find the specified obligation. It might have been deleted or tracked under a different ID.</p>
            <a href="/" class="btn">Go to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  }

  const oldExpiry = reminder.expiryDate;
  if (!oldExpiry) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invalid Expiry Date</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background-color: #F3F4F6;
              color: #1F2937;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
            .card {
              background-color: #FFFFFF;
              border-radius: 12px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              border: 1px solid #E5E7EB;
              padding: 32px;
              max-width: 480px;
              width: 100%;
              text-align: center;
            }
            h1 { font-size: 20px; color: #EF4444; margin-bottom: 12px; }
            p { font-size: 14px; color: #4B5563; line-height: 1.5; margin-bottom: 24px; }
            .btn { background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Invalid Expiry Date</h1>
            <p>This obligation does not have an expiry date configured and cannot be snoozed.</p>
            <a href="/" class="btn">Go to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  }

  // Parse existing date
  const [y, m, d] = oldExpiry.split("-").map(Number);
  let newDate = new Date(y, m - 1, d);

  let durationLabel = "";
  if (duration === "1month") {
    newDate.setMonth(newDate.getMonth() + 1);
    durationLabel = "1 month";
  } else if (duration === "1week") {
    newDate.setDate(newDate.getDate() + 7);
    durationLabel = "1 week";
  } else if (duration === "1day") {
    newDate.setDate(newDate.getDate() + 1);
    durationLabel = "1 day";
  } else {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invalid Snooze Duration</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background-color: #F3F4F6;
              color: #1F2937;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
            .card {
              background-color: #FFFFFF;
              border-radius: 12px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              border: 1px solid #E5E7EB;
              padding: 32px;
              max-width: 480px;
              width: 100%;
              text-align: center;
            }
            h1 { font-size: 20px; color: #EF4444; margin-bottom: 12px; }
            p { font-size: 14px; color: #4B5563; line-height: 1.5; margin-bottom: 24px; }
            .btn { background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Invalid Snooze Duration</h1>
            <p>Please provide a valid snooze duration (1month, 1week, or 1day).</p>
            <a href="/" class="btn">Go to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  }

  const newY = newDate.getFullYear();
  const newM = String(newDate.getMonth() + 1).padStart(2, "0");
  const newD = String(newDate.getDate()).padStart(2, "0");
  const newExpiryStr = `${newY}-${newM}-${newD}`;

  // Update reminder
  reminder.expiryDate = newExpiryStr;
  reminder.status = "Active"; // Reset status to active
  reminder.notes = (reminder.notes || "") + `\n[Snoozed by ${durationLabel} on ${new Date().toISOString().split("T")[0]}]`;

  await saveReminder(reminder, 'update');

  // Return elegant confirmation page
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Snooze Confirmed</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #F3F4F6;
            color: #1F2937;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background-color: #FFFFFF;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border: 1px solid #E5E7EB;
            padding: 32px;
            max-width: 480px;
            width: 100%;
            text-align: center;
          }
          .icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background-color: #ECFDF5;
            color: #10B981;
            border-radius: 50%;
            width: 64px;
            height: 64px;
            margin-bottom: 20px;
          }
          .icon svg {
            width: 32px;
            height: 32px;
          }
          h1 {
            font-size: 20px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 12px;
            color: #111827;
            letter-spacing: -0.025em;
          }
          p {
            font-size: 14px;
            color: #4B5563;
            line-height: 1.5;
            margin-top: 0;
            margin-bottom: 24px;
          }
          .details {
            background-color: #F9FAFB;
            border: 1px solid #F3F4F6;
            border-radius: 8px;
            padding: 16px;
            text-align: left;
            margin-bottom: 24px;
            font-size: 13px;
          }
          .details-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
          }
          .details-label {
            color: #6B7280;
            font-weight: 500;
          }
          .details-value {
            color: #111827;
            font-weight: 600;
          }
          .btn {
            background-color: #2563EB;
            color: #FFFFFF;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            display: inline-block;
            transition: background-color 0.15s ease-in-out;
          }
          .btn:hover {
            background-color: #1D4ED8;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h1>Obligation Snoozed Successfully</h1>
          <p>The obligation <strong>${reminder.itemName}</strong> has been successfully snoozed by <strong>${durationLabel}</strong>.</p>
          
          <div class="details">
            <div class="details-row">
              <span class="details-label">Previous Expiry:</span>
              <span class="details-value" style="text-decoration: line-through; color: #9CA3AF;">${oldExpiry}</span>
            </div>
            <div class="details-row">
              <span class="details-label">New Expiry:</span>
              <span class="details-value" style="color: #10B981;">${newExpiryStr}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Status Reset to:</span>
              <span class="details-value" style="color: #10B981;">Active</span>
            </div>
          </div>

          <a href="/" class="btn">Open App Dashboard</a>
        </div>
      </body>
    </html>
  `);
});

// 0. GET Database Status for UI Indicator
app.get("/api/status", (req, res) => {
  const isSupabaseSdk = getSupabaseClient() !== null;
  const isDirectPg = getPool() !== null;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const isGeminiConfigured = !!geminiApiKey && geminiApiKey.trim() !== "" && geminiApiKey !== "MY_GEMINI_API_KEY";
  res.json({
    database: (isSupabaseSdk || isDirectPg) ? "supabase" : "local",
    urlConfigured: isSupabaseSdk || isDirectPg || !!(process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_ANON_KEY),
    geminiConfigured: isGeminiConfigured
  });
});

// 1. GET Reminders
app.get("/api/reminders", async (req, res) => {
  try {
    const reminders = await getReminders();
    res.json(reminders);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 2. POST (Create) Reminder
app.post("/api/reminders", async (req, res) => {
  try {
    const newReminder = {
      ...req.body,
      id: "rem-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5)
    };
    await saveReminder(newReminder, 'insert');
    res.status(201).json(newReminder);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 3. PUT (Update) Reminder
app.put("/api/reminders/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await getReminderById(id);
    if (existing) {
      let acknowledged = existing.acknowledged;
      let acknowledged_at = existing.acknowledged_at;
      
      const newExpiry = req.body.expiryDate;
      const existingExpiry = existing.expiryDate;
      const isRenewed = req.body.status === 'Renewed' || (req.body.status === 'Active' && existing.status === 'Expired');
      
      if ((newExpiry && newExpiry !== existingExpiry) || isRenewed || req.body.resetAcknowledged) {
        acknowledged = false;
        acknowledged_at = null;
      }

      const updated = {
        ...existing,
        ...req.body,
        id,
        acknowledged,
        acknowledged_at
      };
      await saveReminder(updated, 'update');
      res.json(updated);
    } else {
      res.status(404).json({ error: "Reminder not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 4. DELETE Reminder
app.delete("/api/reminders/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await deleteReminder(id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Reminder not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 5. POST Bulk Reminders (Excel upload merging)
app.post("/api/reminders/bulk", async (req, res) => {
  try {
    const importedList = req.body;
    if (!Array.isArray(importedList)) {
      return res.status(400).json({ error: "Body must be an array of reminders" });
    }

    const processedList = importedList.map((item: any) => ({
      ...item,
      id: item.id || "rem-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5)
    }));

    for (const item of processedList) {
      await saveReminder(item, 'insert');
    }
    res.status(201).json({ count: processedList.length, reminders: processedList });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 6. GET Configuration
app.get("/api/config", async (req, res) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 7. PUT Configuration (Default rules, Category list)
app.put("/api/config", async (req, res) => {
  try {
    await saveConfig(req.body);
    const updated = await getConfig();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 8. GET Notification Logs
app.get("/api/logs", async (req, res) => {
  try {
    const logs = await getLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 9. POST Clear Logs (for testing)
app.post("/api/logs/clear", async (req, res) => {
  try {
    await clearLogs();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// AI Feature 1: Document Upload + Autofill
app.post("/api/ai/analyze-document", async (req, res) => {
  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing fileBase64 or mimeType" });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured in environment secrets." });
    }

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const config = await getConfig();
    const categories = config.categories || [
      "Payment Due",
      "Insurance",
      "Company Asset",
      "Employee Visa",
      "Software License",
      "AMC",
      "Compliance Certificate",
      "Vehicle Insurance",
      "Equipment Servicing",
      "Subscription"
    ];

    const prompt = `Analyze this uploaded document and extract details to auto-fill an Obligation Tracking Form.
Please find:
1. itemName: The official title, name, or description of the contract, policy, license, visa, or AMC (e.g. "Allianz General Liability Insurance").
2. category: Map this document to one of these predefined categories ONLY. Choose the closest one:
   ${categories.map(c => `   - "${c}"`).join("\n")}
3. expiryDate: The official expiration date, renewal date, or end-of-term date of this contract/document. Format it strictly as YYYY-MM-DD.

If you are not highly confident about a field, return null for it. Do not guess.`;

    const filePart = {
      inlineData: {
        mimeType: mimeType,
        data: fileBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [filePart, prompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            itemName: {
              type: Type.STRING,
              nullable: true,
              description: "The name/title of the obligation or document, or null if unknown/not found."
            },
            category: {
              type: Type.STRING,
              nullable: true,
              description: "Must be one of: " + categories.join(", ") + ", or null if unknown/not found."
            },
            expiryDate: {
              type: Type.STRING,
              nullable: true,
              description: "The expiration or due date in YYYY-MM-DD format, or null if unknown/not found."
            }
          },
          required: ["itemName", "category", "expiryDate"]
        },
      },
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (err: any) {
    console.error("[AI Document Upload Error]:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// AI Feature 3: Ask Chatbot Panel
app.post("/api/ai/ask", async (req, res) => {
  try {
    const { question, history } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Missing question" });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured in environment secrets." });
    }

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let reminders: any[] = [];
    const s = getSupabaseClient();
    if (s && isSupabaseAvailable()) {
      try {
        const { data, error } = await runWithTimeout(s.from('reminders').select('*'), 5000);
        if (error) {
          console.error("[Supabase Fetch Error inside Chatbot Ask]:", error);
          return res.status(500).json({ error: `Couldn't load reminder data: ${error.message || JSON.stringify(error)}` });
        }
        reminders = data || [];
      } catch (err: any) {
        console.error("[Supabase Fetch Exception inside Chatbot Ask]:", err);
        return res.status(500).json({ error: `Couldn't load reminder data: ${err.message || String(err)}` });
      }
    } else {
      try {
        reminders = await getReminders();
      } catch (err: any) {
        console.error("[Fallback Fetch Exception inside Chatbot Ask]:", err);
        return res.status(500).json({ error: `Couldn't load reminder data: ${err.message || String(err)}` });
      }
    }

    const config = await getConfig();

    // Limit payload size by picking only necessary fields for AI reasoning
    const simplifiedReminders = reminders.map((r: any) => ({
      itemName: r.itemName || "",
      category: r.category || "",
      responsibleName: r.responsibleName || "",
      responsibleEmail: r.responsibleEmail || "",
      expiryDate: r.expiryDate || "",
      renewalDate: r.renewalDate || "",
      status: r.status || "Active",
      notes: r.notes || "",
      acknowledged: r.acknowledged || false,
      customer_name: r.customer_name || r.customerName || "",
      customer_email: r.customer_email || r.customerEmail || ""
    }));

    const systemInstruction = `You are the Expiry Manager AI Assistant, an expert chatbot designed to help users query, analyze, and understand their obligation/reminder tracking database in plain English.
Today's local date is: ${new Date().toISOString().split("T")[0]}.

CRITICAL RULES:
1. GROUND EVERY ANSWER: You MUST answer the user's question using ONLY the actual data from the active reminders JSON array provided below. Under no circumstances should you invent, hallucinate, guess, or extrapolate dates, names, counts, or emails.
2. EMPTY DATASET: If there are no reminders/obligations in the dataset yet, say so clearly and politely (e.g. "There are currently no obligations tracked in the database. Please add a new reminder or import an Excel file so I can assist you!").
3. LIST LIMITATION (MAX 5): For list-type answers, show a short, readable list of up to 5 items. If there are more than 5 matching items, show the top 5 and explicitly append a note like: "and [X] more — check the dashboard table for the full list."
4. VAGUE QUESTIONS: If a question is vague (e.g., "how are things looking?", "any updates?", "what's the status?"), do NOT refuse. Instead, provide a helpful summary overview from the data (e.g., count of overdue items, items expiring this week, and overall database health status).
5. OUT OF SCOPE: If a question is genuinely unrelated to reminders, obligations, expiry tracking, or the app's configuration (e.g., "what's the weather", "tell me a joke", "who is the president"), politely explain that you can only help with tracking obligations, expiry dates, or vendor details within this application, and briefly suggest what the user can ask you.
6. PERSISTENT ACCURACY: Keep responses short, in plain language, and use professional, clean Markdown formatting (bullet points, bold highlights, or simple tables). Keep explanations concise (no long paragraphs).

Active Configuration:
- Categories: ${JSON.stringify(config.categories)}
- Default Notification Rules: ${JSON.stringify(config.defaultRules)}

Active Reminders Dataset:
${JSON.stringify(simplifiedReminders, null, 2)}`;

    let formattedHistory: any[] = [];
    if (history && Array.isArray(history)) {
      formattedHistory = history.map((h: any) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.message || h.text || "" }]
      }));
    }

    const activeChat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
      },
      history: formattedHistory
    });

    const response = await activeChat.sendMessage({ message: question });
    res.json({ answer: response.text });
  } catch (err: any) {
    console.error("[AI Chatbot Error]:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// AI Feature 4: Voice Note Transcription
app.post("/api/ai/transcribe-voice", async (req, res) => {
  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing fileBase64 or mimeType" });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured in environment secrets." });
    }

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const filePart = {
      inlineData: {
        mimeType: mimeType,
        data: fileBase64,
      },
    };

    const prompt = "Please transcribe this spoken voice note recording accurately. Provide only the plain text transcription. Do not include any introductory text, prefixing labels, or explanations. If the audio is silent or unintelligible, just return an empty string.";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [filePart, prompt]
    });

    const text = response.text || "";
    res.json({ text: text.trim() });
  } catch (err: any) {
    console.error("[AI Voice Transcription Error]:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// AI Feature 5: Parse Command (Voice or Text Intent Extraction)
app.post("/api/ai/parse-command", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured in environment secrets." });
    }

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `Analyze this user's text (transcribed from voice or typed in chatbot input): "${text}"

Determine if it matches one of these structured commands:
1. "create": Creating a new obligation/reminder. For example: "Create a new reminder named Fire Insurance, category Insurance, expiring on next Monday". Required fields are itemName and expiryDate. If these are missing or incomplete, list them in missingFields and ask for clarification in followUpQuestion.
2. "renew": Renewing an existing reminder. For example: "Renew General Liability Insurance" or "renew Building Lease".
3. "search": Searching or filtering the reminders database. For example: "Show me all overdue insurance reminders" or "search for Pranav K's reminders".
4. "update_status": Marking a reminder as acknowledged. For example: "Mark fire alarm check as acknowledged" or "Acknowledge the elevator maintenance reminder".

If the user's intent doesn't match any of the above (e.g. it is a question about a reminder like "what is overdue?" or "how are things looking?" or a general conversational query), classify commandType as "question".

Today's local date is: ${new Date().toISOString().split("T")[0]}. Use this to resolve relative dates (like "next Monday", "in 3 weeks", "by end of this month") into exact YYYY-MM-DD strings.

For "create" commands:
- responsibleName should default to "Pranav K" if not specified.
- responsibleEmail should default to "pranavk.aconsultancy@gmail.com" if responsibleName is "Pranav K" and not specified, or be extracted if mentioned.
- category: match or choose one of the closest categories if mentioned.
- itemName: extract the exact or clean name of the reminder.
- notes: include any extra description.
- customer_name: extract the customer or client name if mentioned (e.g., if they say "for customer ACME Corp" or "client Neemrana Kulkarni").
- customer_email: extract any customer or client email address if mentioned.

For "search" commands, extract any filters:
- category: if they filter by a specific category (e.g. "insurance")
- status: if they filter by status. Classify as "Overdue" (for overdue/expired), "Expiring Soon" (for expiring soon/due soon), or "Active" (for healthy/active).
- text: any name or search text (e.g., "insurance", "Pranav", etc.).

If required fields for a command are missing, specify them in the missingFields array and provide a short, natural, and friendly followUpQuestion asking for them. Do not guess dates if none were provided or implied!`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        commandType: {
          type: Type.STRING,
          description: "One of: 'create', 'renew', 'search', 'update_status', 'question'"
        },
        extractedData: {
          type: Type.OBJECT,
          description: "Data extracted for the command if applicable",
          properties: {
            itemName: { type: Type.STRING },
            category: { type: Type.STRING },
            expiryDate: { type: Type.STRING, description: "Expiry date in YYYY-MM-DD format" },
            responsibleName: { type: Type.STRING },
            responsibleEmail: { type: Type.STRING },
            notes: { type: Type.STRING },
            customer_name: { type: Type.STRING, description: "Customer name if mentioned" },
            customer_email: { type: Type.STRING, description: "Customer email if mentioned" }
          }
        },
        searchFilters: {
          type: Type.OBJECT,
          description: "Filters if commandType is 'search'",
          properties: {
            text: { type: Type.STRING },
            category: { type: Type.STRING },
            status: { type: Type.STRING, description: "One of: 'Overdue', 'Expiring Soon', 'Active', or empty" }
          }
        },
        missingFields: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Required fields that are missing (e.g., ['expiryDate', 'itemName'])"
        },
        followUpQuestion: {
          type: Type.STRING,
          description: "Short friendly question if some required details are missing"
        }
      },
      required: ["commandType"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const parsedResult = JSON.parse(response.text || "{}");
    res.json(parsedResult);
  } catch (err: any) {
    console.error("[AI Parse Command Error]:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 9.5 POST Send Test Email
app.post("/api/send-test-email", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email address is required" });
  }

  const config = await getConfig();
  const globalRules = config.defaultRules || [];
  const disableSandboxRedirect = globalRules.includes("disable_sandbox_redirect");

  const resendApiKey = process.env.RESEND_API_KEY;
  const isPlaceholderKey = !resendApiKey || resendApiKey === "MY_RESEND_API_KEY" || resendApiKey.trim() === "";

  const subject = "Test Email — Reminder System Check";
  const todayStr = new Date().toLocaleString();

  let emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Test Email — Reminder System Check</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; padding: 20px; color: #1F2937; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <div style="background-color: #10B981; padding: 24px; text-align: center;">
            <h1 style="color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em;">Email System Integration Success</h1>
          </div>
          <div style="padding: 24px; line-height: 1.6;">
            <p style="margin-top: 0; font-size: 16px; color: #374151;">Hello,</p>
            <p style="color: #4B5563;">This is a system-generated test email confirming that your Resend integration is configured and working perfectly!</p>
            
            <div style="background-color: #F9FAFB; border: 1px solid #F3F4F6; border-left: 4px solid #10B981; border-radius: 6px; padding: 18px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #6B7280; font-size: 14px; width: 35%;"><strong>Test Type:</strong></td>
                  <td style="padding: 4px 0; color: #111827; font-size: 14px;">Manual Connection Diagnostics</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6B7280; font-size: 14px;"><strong>Target Recipient:</strong></td>
                  <td style="padding: 4px 0; color: #111827; font-size: 14px;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6B7280; font-size: 14px;"><strong>Timestamp:</strong></td>
                  <td style="padding: 4px 0; color: #111827; font-size: 14px; font-family: monospace;">${todayStr}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6B7280; font-size: 14px;"><strong>Integration:</strong></td>
                  <td style="padding: 4px 0; color: #111827; font-size: 14px;">Resend API</td>
                </tr>
              </table>
            </div>

            <p style="color: #4B5563; font-size: 14px;">No further action is required. You can now confidently set up real compliance and obligation reminders knowing your alert notifications will reach their targets.</p>
          </div>
          <div style="background-color: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 16px; text-align: center; font-size: 12px; color: #9CA3AF;">
            Reminder & Expiry Manager System Diagnostic Test.
          </div>
        </div>
      </body>
    </html>
  `;

  let success = false;
  let errorDetail = "";
  let recipientEmailForResend = email;
  let isRedirected = false;

  if (!disableSandboxRedirect && recipientEmailForResend !== "pranavk.aconsultancy@gmail.com") {
    recipientEmailForResend = "pranavk.aconsultancy@gmail.com";
    isRedirected = true;
  }

  if (isRedirected) {
    const redirectBadge = `
      <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 12px; margin-bottom: 20px; text-align: left; font-size: 13px; color: #92400E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <strong>Sandbox Notice:</strong> This diagnostic test was originally addressed to <strong>${email}</strong>. It has been safely routed to <strong>pranavk.aconsultancy@gmail.com</strong> to comply with Resend Sandbox restrictions and ensure delivery.
      </div>
    `;
    emailHtml = emailHtml.replace(
      '<div style="padding: 24px; line-height: 1.6;">',
      `<div style="padding: 24px; line-height: 1.6;">${redirectBadge}`
    );
  }

  if (!isPlaceholderKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: "Expiry Manager <onboarding@resend.dev>",
          to: [recipientEmailForResend],
          subject: subject,
          html: emailHtml
        })
      });

      if (response.ok) {
        success = true;
        console.log(`Test email successfully sent via Resend to ${recipientEmailForResend} (requested: ${email})`);
      } else {
        const errRes = await response.json();
        errorDetail = typeof errRes === "object" ? JSON.stringify(errRes) : String(errRes);
        console.error(`Resend API error sending test email: ${errorDetail}`);
      }
    } catch (err: any) {
      errorDetail = err.message || String(err);
      console.error(`Failed to send test email to ${recipientEmailForResend}:`, err);
    }
  } else {
    success = false;
    errorDetail = "Missing or invalid RESEND_API_KEY in environment secrets. Please configure your real Resend API key to send actual emails.";
  }

  // Create a log entry for the test email
  const logEntry = {
    id: "log-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
    reminderId: "test-system",
    reminderName: "Email Diagnostics Check",
    recipientName: "System Administrator",
    recipientEmail: email,
    triggerType: "Test Email",
    triggerDate: new Date().toISOString().split("T")[0],
    sentAt: new Date().toISOString(),
    status: success ? "success" : "failure",
    errorDetail: errorDetail || undefined,
    emailSubject: subject,
    emailBody: emailHtml
  };

  await saveLog(logEntry);

  if (success) {
    res.json({ success: true, email, logEntry });
  } else {
    res.status(500).json({ success: false, error: errorDetail, logEntry });
  }
});

// 10. POST Trigger / Simulate Reminder checks
app.post("/api/check-reminders", async (req, res) => {
  const targetDate = req.body.date || new Date().toISOString().split("T")[0];
  const triggerEmails = req.body.triggerEmails !== false; // defaults to true
  try {
    const result = await checkAndSendReminders(targetDate, triggerEmails);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Daily Scheduled Trigger check
let lastSchedulerRunDate: string | null = null;

function runDailyScheduler() {
  const todayStr = new Date().toISOString().split("T")[0];
  if (lastSchedulerRunDate === todayStr) {
    console.log(`[Scheduler] Daily check already ran for today (${todayStr}). Skipping repeat check.`);
    return;
  }
  lastSchedulerRunDate = todayStr;
  console.log(`[Scheduler] Running daily scheduled trigger check for ${todayStr}...`);
  checkAndSendReminders(todayStr, true)
    .then(result => {
      console.log(`[Scheduler] Daily check completed for ${todayStr}. Checked ${result.checked}, Sent ${result.sent} emails.`);
    })
    .catch(err => {
      console.error("[Scheduler] Error running daily scheduled reminder check:", err);
    });
}

function startScheduler() {
  const schedulerHour = parseInt(process.env.SCHEDULER_HOUR || "7", 10);
  const now = new Date();
  
  // Calculate today's target time
  const todayTarget = new Date();
  todayTarget.setHours(schedulerHour, 0, 0, 0);
  
  if (now.getTime() >= todayTarget.getTime()) {
    // We are past today's scheduler hour. Run the check now (if not already run today)
    console.log(`[Scheduler] Server started after scheduler hour (${schedulerHour}:00). Running initial check in 5 seconds...`);
    setTimeout(runDailyScheduler, 5000);
    
    // Schedule next run for tomorrow at 7:00 AM
    const tomorrowTarget = new Date();
    tomorrowTarget.setDate(tomorrowTarget.getDate() + 1);
    tomorrowTarget.setHours(schedulerHour, 0, 0, 0);
    const delay = tomorrowTarget.getTime() - now.getTime();
    console.log(`[Scheduler] Scheduling next daily check for ${tomorrowTarget.toString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);
    
    setTimeout(() => {
      runDailyScheduler();
      // Keep scheduling every 24 hours
      setInterval(runDailyScheduler, 24 * 60 * 60 * 1000);
    }, delay);
  } else {
    // We are before today's scheduler hour. Schedule for today at 7:00 AM
    const delay = todayTarget.getTime() - now.getTime();
    console.log(`[Scheduler] Server started before scheduler hour (${schedulerHour}:00). Scheduling check for ${todayTarget.toString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);
    
    setTimeout(() => {
      runDailyScheduler();
      // Keep scheduling every 24 hours
      setInterval(runDailyScheduler, 24 * 60 * 60 * 1000);
    }, delay);
  }
}

// Start the scheduler
startScheduler();

// Process-level unhandled exception/rejection loggers
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Unhandled Promise Rejection] at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Uncaught Exception] occurred:", err);
});

// Global Express Error Handler Middleware (ensures JSON responses on errors)
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[Unhandled Express Error]:", err);
  res.status(err.status || 500).json({
    error: err.message || "An unhandled server error occurred",
    details: err.stack || String(err)
  });
});

// Integrate Vite middleware for development or Static Assets for production
async function startServer() {
  // Ensure database tables and schema are bootstrapped on startup
  try {
    console.log("[Startup] Bootstrapping database schema...");
    await ensureTables();
  } catch (err) {
    console.error("[Startup] Database bootstrapping failed:", err);
  }

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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
