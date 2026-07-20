import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, 
  CalendarRange, 
  Settings2, 
  BellRing, 
  Plus, 
  AlertCircle, 
  Check, 
  Loader2,
  Clock,
  Briefcase
} from "lucide-react";
import { Reminder, GlobalConfig, DEFAULT_CATEGORIES } from "./types";
import { 
  fetchReminders, 
  createReminder, 
  updateReminder, 
  deleteReminder, 
  fetchGlobalConfig, 
  updateGlobalConfig,
  fetchDatabaseStatus,
  DatabaseStatus
} from "./lib/api";

// Core Screen Imports
import Dashboard from "./components/Dashboard";
import CalendarView from "./components/CalendarView";
import ReminderForm from "./components/ReminderForm";
import ExcelUpload from "./components/ExcelUpload";
import RulesManager from "./components/RulesManager";
import NotificationsLog from "./components/NotificationsLog";
import Chatbot from "./components/Chatbot";
import VoiceCommandButton from "./components/VoiceCommandButton";
import SyncAILogo from "./components/SyncAILogo";

type ActiveTab = "dashboard" | "calendar" | "add" | "upload" | "rules" | "logs";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [config, setConfig] = useState<GlobalConfig>({
    defaultRules: ["one_month_before", "one_week_before", "on_expiry"],
    categories: DEFAULT_CATEGORIES
  });
  
  // Chatbot logo state
  const [chatbotLogo, setChatbotLogo] = useState<string>(() => {
    try {
      return localStorage.getItem("chatbot_custom_logo") || "";
    } catch {
      return "";
    }
  });

  const handleLogoChange = (newLogo: string) => {
    setChatbotLogo(newLogo);
    try {
      if (newLogo) {
        localStorage.setItem("chatbot_custom_logo", newLogo);
      } else {
        localStorage.removeItem("chatbot_custom_logo");
      }
    } catch (e) {
      console.error(e);
    }
  };
  
  // App-level database status
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  
  // App-level loading and alerts
  const [isLoading, setIsLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Alert dismiss states for exactly 1 week (7 days) and 1 day left warnings
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("dismissed_timeline_alerts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const getDaysRemainingLocal = (expiryStr: string): number => {
    if (!expiryStr) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryStr);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleDismissAlert = (alertKey: string) => {
    const updated = [...dismissedAlerts, alertKey];
    setDismissedAlerts(updated);
    try {
      localStorage.setItem("dismissed_timeline_alerts", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Load all initial data from API
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [remindersData, configData, statusData] = await Promise.all([
        fetchReminders(),
        fetchGlobalConfig(),
        fetchDatabaseStatus().catch(() => ({ database: "local" as const, urlConfigured: false }))
      ]);
      setReminders(remindersData);
      if (configData && configData.categories && configData.categories.length > 0) {
        setConfig(configData);
      }
      setDbStatus(statusData);
    } catch (err) {
      console.error("Error loading application state:", err);
      showAlert("error", "Failed to sync with full-stack server. Ensure the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleDbChange = () => {
      loadData();
    };
    const handleApplyFilter = () => {
      setActiveTab("dashboard");
    };

    window.addEventListener("database-changed", handleDbChange);
    window.addEventListener("apply-dashboard-filter", handleApplyFilter);

    return () => {
      window.removeEventListener("database-changed", handleDbChange);
      window.removeEventListener("apply-dashboard-filter", handleApplyFilter);
    };
  }, []);

  // Utility to display temporary alerts
  const showAlert = (type: "success" | "error", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => {
      setAlertMsg(null);
    }, 4000);
  };

  // 1. ADD / EDIT Reminder Save
  const handleSaveReminder = async (formData: Omit<Reminder, "id">) => {
    try {
      if (editingReminder) {
        // Edit flow
        const updated = await updateReminder(editingReminder.id, formData);
        setReminders(reminders.map((r) => (r.id === editingReminder.id ? updated : r)));
        showAlert("success", `Successfully updated obligation: "${formData.itemName}"`);
      } else {
        // Create flow
        const created = await createReminder(formData);
        setReminders([created, ...reminders]);
        showAlert("success", `Successfully added new obligation: "${formData.itemName}"`);
      }
      setEditingReminder(null);
      setActiveTab("dashboard");
    } catch (err: any) {
      console.error("Save error:", err);
      throw err;
    }
  };

  // 2. DELETE Reminder
  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteReminder(id);
      setReminders(reminders.filter((r) => r.id !== id));
      showAlert("success", "Obligation successfully removed.");
    } catch (err) {
      console.error("Delete error:", err);
      showAlert("error", "Failed to delete obligation.");
    }
  };

  // 3. QUICK RENEW Reminder (from dashboard table action)
  const handleQuickRenew = async (
    id: string, 
    newExpiry: string, 
    newRenewal: string, 
    notes: string,
    historyEntry?: any
  ) => {
    try {
      const existing = reminders.find(r => r.id === id);
      const updatedHistory = existing?.renewalHistory ? [...existing.renewalHistory] : [];
      if (historyEntry) {
        updatedHistory.push(historyEntry);
      }

      const updated = await updateReminder(id, {
        expiryDate: newExpiry,
        renewalDate: newRenewal || "",
        notes: notes,
        status: "Active", // Reset status back to Active / Healthy
        renewalHistory: updatedHistory
      });
      setReminders(reminders.map((r) => (r.id === id ? updated : r)));
      showAlert("success", "Obligation successfully renewed with new expiry parameters!");
    } catch (err) {
      console.error("Quick renew error:", err);
      showAlert("error", "Failed to perform quick renewal on obligation.");
    }
  };

  // 4. SAVE CONFIG (Rules and categories)
  const handleSaveConfig = async (newConfig: GlobalConfig) => {
    try {
      const saved = await updateGlobalConfig(newConfig);
      setConfig(saved);
      showAlert("success", "Saved global notification rules and category list.");
    } catch (err) {
      console.error("Config save error:", err);
      throw err;
    }
  };

  // 5. ADD CATEGORY inline from manual form
  const handleAddCategoryInline = async (newCat: string) => {
    const updatedCategories = [...config.categories, newCat];
    try {
      await handleSaveConfig({ ...config, categories: updatedCategories });
    } catch (err) {
      console.error("Category save error:", err);
    }
  };

  const handleEditClick = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setActiveTab("add");
  };

  const handleAddNewClick = () => {
    setEditingReminder(null);
    setActiveTab("add");
  };

  const handleExcelUploadSuccess = (count: number) => {
    showAlert("success", `Successfully imported ${count} business obligations!`);
    loadData(); // reload entire table from server
    setActiveTab("dashboard");
  };

  // Get list of categories in active use by reminders (to prevent settings deletions)
  const usedCategories = reminders.map((r) => r.category);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1F2937] font-sans antialiased flex flex-col">
      {/* App Header */}
      <header className="sticky top-0 bg-white border-b border-gray-100 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <SyncAILogo height={40} />
              {dbStatus && (
                <span 
                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border select-none ${
                    dbStatus.database === "supabase"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}
                  title={
                    dbStatus.database === "supabase"
                      ? "Connected to Supabase PostgreSQL database successfully!"
                      : "Running in local storage fallback mode. Connect your Supabase DATABASE_URL in secrets."
                  }
                >
                  {dbStatus.database}
                </span>
              )}
            </div>

            {/* Segmented Pill Navigation */}
            <nav className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => { setActiveTab("dashboard"); setEditingReminder(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => { setActiveTab("calendar"); setEditingReminder(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "calendar"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Calendar
              </button>
              <button
                onClick={handleAddNewClick}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "add" && !editingReminder
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {editingReminder ? "Editing Item" : "Add Obligation"}
              </button>
              <button
                onClick={() => { setActiveTab("upload"); setEditingReminder(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "upload"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Excel Import
              </button>
              <button
                onClick={() => { setActiveTab("rules"); setEditingReminder(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "rules"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Alert Rules
              </button>
              <button
                onClick={() => { setActiveTab("logs"); setEditingReminder(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "logs"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Logs &amp; Simulation
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Floating Success/Error Alerts */}
      {alertMsg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-fade-in">
          <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-xs ${
            alertMsg.type === "success"
              ? "bg-green-50 border-green-100 text-green-800"
              : "bg-red-50 border-red-100 text-red-800"
          }`}>
            {alertMsg.type === "success" ? (
              <Check className="w-5 h-5 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <span className="text-xs font-medium">{alertMsg.text}</span>
          </div>
        </div>
      )}

      {/* Critical Timeline Alerts (1 week / 1 day left) */}
      {!isLoading && reminders.filter(r => {
        if (r.status === "Expired") return false;
        const days = getDaysRemainingLocal(r.expiryDate);
        if (days !== 7 && days !== 1) return false;
        const alertKey = `${r.id}_${days}`;
        return !dismissedAlerts.includes(alertKey);
      }).length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 space-y-2 animate-fade-in">
          {reminders.filter(r => {
            if (r.status === "Expired") return false;
            const days = getDaysRemainingLocal(r.expiryDate);
            if (days !== 7 && days !== 1) return false;
            const alertKey = `${r.id}_${days}`;
            return !dismissedAlerts.includes(alertKey);
          }).map(r => {
            const days = getDaysRemainingLocal(r.expiryDate);
            const isOneDay = days === 1;
            const alertKey = `${r.id}_${days}`;
            return (
              <div 
                key={alertKey}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 shadow-xs ${
                  isOneDay 
                    ? "bg-red-50/90 border-red-200 text-red-900" 
                    : "bg-amber-50/95 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isOneDay ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                      {isOneDay ? (
                        <>
                          <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                          🚨 URGENT WARNING: Only 1 Day Left!
                        </>
                      ) : (
                        <>
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          ⚠️ WARNING: Only 1 Week Left!
                        </>
                      )}
                    </p>
                    <p className="text-[11px] opacity-90 mt-1 leading-relaxed">
                      The obligation <strong>{r.itemName}</strong> (Category: <strong>{r.category}</strong>) assigned to <strong>{r.responsibleName}</strong> is expiring on <strong>{r.expiryDate}</strong>.
                    </p>
                  </div>
                </div>
                
                <label className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-gray-200/40 bg-white/60 hover:bg-white/80 cursor-pointer select-none shrink-0 transition-colors self-end sm:self-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    onChange={() => handleDismissAlert(alertKey)}
                  />
                  <span className="text-xs font-bold text-gray-700">Dismiss Alert</span>
                </label>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Synchronizing Obligation Records...</p>
          </div>
        ) : (
          <div className="animate-fade-in">
            {activeTab === "dashboard" && (
              <Dashboard
                reminders={reminders}
                categories={config.categories}
                config={config}
                dbStatus={dbStatus}
                onAddNew={handleAddNewClick}
                onEdit={handleEditClick}
                onDelete={handleDeleteReminder}
                onQuickRenew={handleQuickRenew}
                onSaveDirect={handleSaveReminder}
                onAddCategory={handleAddCategoryInline}
              />
            )}

            {activeTab === "calendar" && (
              <CalendarView
                reminders={reminders}
                onEdit={handleEditClick}
              />
            )}

            {activeTab === "add" && (
              <ReminderForm
                reminder={editingReminder}
                categories={config.categories}
                onSave={handleSaveReminder}
                onCancel={() => { setActiveTab("dashboard"); setEditingReminder(null); }}
                onAddCategory={handleAddCategoryInline}
              />
            )}

            {activeTab === "upload" && (
              <ExcelUpload
                onUploadSuccess={handleExcelUploadSuccess}
                categories={config.categories}
              />
            )}

            {activeTab === "rules" && (
              <RulesManager
                config={config}
                onSaveConfig={handleSaveConfig}
                usedCategories={usedCategories}
                chatbotLogo={chatbotLogo}
                onLogoChange={handleLogoChange}
              />
            )}

            {activeTab === "logs" && (
              <NotificationsLog
                onRefreshReminders={loadData}
              />
            )}
          </div>
        )}
      </main>

      {/* Humble Footer */}
      <footer className="bg-white border-t border-gray-100 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-gray-400 font-medium">
          <div>
            &copy; 2026 SyncAI Consultancy Pvt. Ltd. | Expiry &amp; Obligations Manager. All Rights Reserved.
          </div>
          <div className="flex items-center gap-3">
            <span>Security: Zero-Trust Policy</span>
            <span>•</span>
            <span>API Gateway: Active</span>
          </div>
        </div>
      </footer>

      {/* Floating Chatbot Panel */}
      <Chatbot reminders={reminders} chatbotLogo={chatbotLogo} />
    </div>
  );
}
