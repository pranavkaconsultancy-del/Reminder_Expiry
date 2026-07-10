import { Reminder, GlobalConfig, NotificationLog } from "../types";

export async function fetchReminders(): Promise<Reminder[]> {
  const res = await fetch("/api/reminders");
  if (!res.ok) throw new Error("Failed to fetch reminders");
  return res.json();
}

export async function createReminder(reminder: Omit<Reminder, "id">): Promise<Reminder> {
  const res = await fetch("/api/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reminder),
  });
  if (!res.ok) throw new Error("Failed to create reminder");
  return res.json();
}

export async function updateReminder(id: string, reminder: Partial<Reminder>): Promise<Reminder> {
  const res = await fetch(`/api/reminders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reminder),
  });
  if (!res.ok) throw new Error("Failed to update reminder");
  return res.json();
}

export async function deleteReminder(id: string): Promise<void> {
  const res = await fetch(`/api/reminders/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete reminder");
}

export async function bulkUploadReminders(reminders: Omit<Reminder, "id">[]): Promise<{ count: number; reminders: Reminder[] }> {
  const res = await fetch("/api/reminders/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reminders),
  });
  if (!res.ok) throw new Error("Failed to bulk upload reminders");
  return res.json();
}

export async function fetchGlobalConfig(): Promise<GlobalConfig> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to fetch global config");
  return res.json();
}

export async function updateGlobalConfig(config: Partial<GlobalConfig>): Promise<GlobalConfig> {
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update global config");
  return res.json();
}

export async function fetchNotificationLogs(): Promise<NotificationLog[]> {
  const res = await fetch("/api/logs");
  if (!res.ok) throw new Error("Failed to fetch notification logs");
  return res.json();
}

export async function clearNotificationLogs(): Promise<void> {
  const res = await fetch("/api/logs/clear", {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to clear notification logs");
}

export async function sendTestEmail(email: string): Promise<{ success: boolean; email: string; logEntry: NotificationLog }> {
  const res = await fetch("/api/send-test-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to send test email");
  }
  return res.json();
}

export interface DatabaseStatus {
  database: "supabase" | "local";
  urlConfigured: boolean;
}

export async function fetchDatabaseStatus(): Promise<DatabaseStatus> {
  const res = await fetch("/api/status");
  if (!res.ok) throw new Error("Failed to fetch database status");
  return res.json();
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
  if (!res.ok) throw new Error("Failed to run trigger simulation");
  return res.json();
}
