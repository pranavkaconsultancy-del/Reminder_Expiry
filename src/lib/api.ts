import { Reminder, GlobalConfig, NotificationLog } from "../types";

// Helper to safely parse JSON and throw descriptive errors when the response is HTML/text (like 404 pages)
async function safeJson(res: Response): Promise<any> {
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    let text = "";
    try {
      text = await res.text();
    } catch (e) {
      // Ignore body read errors
    }
    const snippet = text ? text.substring(0, 150).trim() : "Empty Response";
    throw new Error(
      `API returned an unexpected non-JSON response (HTTP ${res.status}).\n` +
      `This often happens if the backend server isn't running or if a route doesn't exist on your static hosting.\n` +
      `Response prefix: "${snippet}"`
    );
  }
  try {
    return await res.json();
  } catch (err: any) {
    throw new Error(`Failed to parse JSON response: ${err?.message || err}`);
  }
}

export async function fetchReminders(): Promise<Reminder[]> {
  const res = await fetch("/api/reminders");
  if (!res.ok) {
    // Attempt to parse any structured error if possible, else throw generic
    try {
      const errData = await safeJson(res);
      throw new Error(errData.error || `Failed to fetch reminders (HTTP ${res.status})`);
    } catch (e: any) {
      throw new Error(e.message || `Failed to fetch reminders (HTTP ${res.status})`);
    }
  }
  return safeJson(res);
}

export async function createReminder(reminder: Omit<Reminder, "id">): Promise<Reminder> {
  try {
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reminder),
    });
    if (!res.ok) {
      let errData: any = {};
      try {
        errData = await safeJson(res);
      } catch (e: any) {
        throw new Error(e.message || `Failed to create reminder (HTTP ${res.status})`);
      }
      throw new Error(errData.error || "Failed to create reminder");
    }
    return await safeJson(res);
  } catch (err) {
    console.error("Supabase insert exception in browser:", err);
    throw err;
  }
}

export async function updateReminder(id: string, reminder: Partial<Reminder>): Promise<Reminder> {
  try {
    const res = await fetch(`/api/reminders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reminder),
    });
    if (!res.ok) {
      let errData: any = {};
      try {
        errData = await safeJson(res);
      } catch (e: any) {
        throw new Error(e.message || `Failed to update reminder (HTTP ${res.status})`);
      }
      throw new Error(errData.error || "Failed to update reminder");
    }
    return await safeJson(res);
  } catch (err) {
    console.error("Supabase update exception in browser:", err);
    throw err;
  }
}

export async function deleteReminder(id: string): Promise<void> {
  const res = await fetch(`/api/reminders/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    try {
      const errData = await safeJson(res);
      throw new Error(errData.error || `Failed to delete reminder (HTTP ${res.status})`);
    } catch (e: any) {
      throw new Error(e.message || `Failed to delete reminder (HTTP ${res.status})`);
    }
  }
}

export async function bulkUploadReminders(reminders: Omit<Reminder, "id">[]): Promise<{ count: number; reminders: Reminder[] }> {
  const res = await fetch("/api/reminders/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reminders),
  });
  if (!res.ok) {
    try {
      const errData = await safeJson(res);
      throw new Error(errData.error || `Failed to bulk upload reminders (HTTP ${res.status})`);
    } catch (e: any) {
      throw new Error(e.message || `Failed to bulk upload reminders (HTTP ${res.status})`);
    }
  }
  return safeJson(res);
}

export async function fetchGlobalConfig(): Promise<GlobalConfig> {
  const res = await fetch("/api/config");
  if (!res.ok) {
    try {
      const errData = await safeJson(res);
      throw new Error(errData.error || `Failed to fetch global config (HTTP ${res.status})`);
    } catch (e: any) {
      throw new Error(e.message || `Failed to fetch global config (HTTP ${res.status})`);
    }
  }
  return safeJson(res);
}

export async function updateGlobalConfig(config: Partial<GlobalConfig>): Promise<GlobalConfig> {
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    try {
      const errData = await safeJson(res);
      throw new Error(errData.error || `Failed to update global config (HTTP ${res.status})`);
    } catch (e: any) {
      throw new Error(e.message || `Failed to update global config (HTTP ${res.status})`);
    }
  }
  return safeJson(res);
}

export async function fetchNotificationLogs(): Promise<NotificationLog[]> {
  const res = await fetch("/api/logs");
  if (!res.ok) {
    try {
      const errData = await safeJson(res);
      throw new Error(errData.error || `Failed to fetch notification logs (HTTP ${res.status})`);
    } catch (e: any) {
      throw new Error(e.message || `Failed to fetch notification logs (HTTP ${res.status})`);
    }
  }
  return safeJson(res);
}

export async function clearNotificationLogs(): Promise<void> {
  const res = await fetch("/api/logs/clear", {
    method: "POST",
  });
  if (!res.ok) {
    try {
      const errData = await safeJson(res);
      throw new Error(errData.error || `Failed to clear notification logs (HTTP ${res.status})`);
    } catch (e: any) {
      throw new Error(e.message || `Failed to clear notification logs (HTTP ${res.status})`);
    }
  }
}

export async function sendTestEmail(email: string): Promise<{ success: boolean; email: string; logEntry: NotificationLog }> {
  const res = await fetch("/api/send-test-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    let errData: any = {};
    try {
      errData = await safeJson(res);
    } catch (e: any) {
      throw new Error(e.message || `Failed to send test email (HTTP ${res.status})`);
    }
    throw new Error(errData.error || "Failed to send test email");
  }
  return safeJson(res);
}

export interface DatabaseStatus {
  database: "supabase" | "local";
  urlConfigured: boolean;
  error?: string | null;
}

export async function fetchDatabaseStatus(): Promise<DatabaseStatus> {
  const res = await fetch("/api/status");
  if (!res.ok) {
    try {
      const errData = await safeJson(res);
      throw new Error(errData.error || `Failed to fetch database status (HTTP ${res.status})`);
    } catch (e: any) {
      throw new Error(e.message || `Failed to fetch database status (HTTP ${res.status})`);
    }
  }
  return safeJson(res);
}

export interface SimulationResult {
  checked: number;
  sent: number;
  matches: {
    itemName: string;
    recipient: string;
    rule: string;
    daysRemaining: number;
  }[];
}

export async function runTriggerSimulation(date: string, triggerEmails: boolean): Promise<SimulationResult> {
  const res = await fetch("/api/check-reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, triggerEmails }),
  });
  if (!res.ok) {
    try {
      const errData = await safeJson(res);
      throw new Error(errData.error || `Failed to run trigger simulation (HTTP ${res.status})`);
    } catch (e: any) {
      throw new Error(e.message || `Failed to run trigger simulation (HTTP ${res.status})`);
    }
  }
  return safeJson(res);
}
