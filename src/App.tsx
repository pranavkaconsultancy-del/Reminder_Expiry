import React, { useState, useEffect } from "react";
import { 
  Menu,
  X,
  Search,
  Bell,
  User,
  LayoutDashboard,
  Calendar,
  Plus,
  Upload,
  Sliders,
  History,
  AlertCircle, 
  Check, 
  Loader2,
  Clock
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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
      // 1. Fetch status independently
      const statusData = await fetchDatabaseStatus().catch((err) => {
        console.warn("Server offline/unreachable. Database status query fell back locally:", err);
        return {
          database: "local" as const,
          urlConfigured: false,
          error: "Full-stack server is offline or unreachable."
        };
      });
      setDbStatus(statusData);

      // 2. Fetch reminders independently
      let remindersData: Reminder[] = [];
      try {
        remindersData = await fetchReminders();
        // Cache successful fetch to local storage as backup
        localStorage.setItem("local_reminders_fallback", JSON.stringify(remindersData));
      } catch (err: any) {
        console.warn("Failed to fetch reminders from full-stack server (using browser localStorage fallback):", err);
        const cached = localStorage.getItem("local_reminders_fallback");
        if (cached) {
          try {
            remindersData = JSON.parse(cached);
          } catch (e) {
            remindersData = [];
          }
        } else {
          // Default initial mock data for instant feedback if brand new
          remindersData = [
            {
              id: "fallback-1",
              itemName: "Business Registration Certificate Renewal",
              category: "Legal & Regulatory",
              responsibleName: "Internal Compliance Team",
              responsibleEmail: "compliance@company.com",
              expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              renewalDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: "Active",
              notes: "Requires updated balance sheet and standard filing fee.",
              customer_name: "Apex Consulting Ltd",
              customer_email: "compliance@apex.com"
            },
            {
              id: "fallback-2",
              itemName: "AWS Enterprise Cloud Subscription",
              category: "Software Licenses",
              responsibleName: "Infrastructure Lead",
              responsibleEmail: "ops@company.com",
              expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: "Active",
              notes: "Automatic credit card billing enabled. Review budget.",
              customer_name: "DevOps Lead",
              customer_email: "infra@apex.com"
            }
          ];
          localStorage.setItem("local_reminders_fallback", JSON.stringify(remindersData));
        }
      }
      setReminders(remindersData);

      // 3. Fetch global config independently
      let configData: GlobalConfig | null = null;
      try {
        configData = await fetchGlobalConfig();
        localStorage.setItem("local_config_fallback", JSON.stringify(configData));
      } catch (err) {
        console.warn("Failed to fetch global config from server (using browser config fallback):", err);
        const cachedConfig = localStorage.getItem("local_config_fallback");
        if (cachedConfig) {
          try {
            configData = JSON.parse(cachedConfig);
          } catch (e) {
            configData = null;
          }
        }
      }

      if (configData && configData.categories && configData.categories.length > 0) {
        setConfig(configData);
      }
    } catch (err) {
      console.error("General error in loadData:", err);
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
        try {
          const updated = await updateReminder(editingReminder.id, formData);
          const newReminders = reminders.map((r) => (r.id === editingReminder.id ? updated : r));
          setReminders(newReminders);
          localStorage.setItem("local_reminders_fallback", JSON.stringify(newReminders));
          showAlert("success", `Successfully updated obligation: "${formData.itemName}"`);
        } catch (serverErr) {
          console.warn("Server update failed, saving locally:", serverErr);
          const localUpdated = { ...formData, id: editingReminder.id } as Reminder;
          const newReminders = reminders.map((r) => (r.id === editingReminder.id ? localUpdated : r));
          setReminders(newReminders);
          localStorage.setItem("local_reminders_fallback", JSON.stringify(newReminders));
          showAlert("success", `Updated locally: "${formData.itemName}" (Server offline)`);
        }
      } else {
        // Create flow
        try {
          const created = await createReminder(formData);
          const newReminders = [created, ...reminders];
          setReminders(newReminders);
          localStorage.setItem("local_reminders_fallback", JSON.stringify(newReminders));
          showAlert("success", `Successfully added new obligation: "${formData.itemName}"`);
        } catch (serverErr) {
          console.warn("Server create failed, saving locally:", serverErr);
          const localCreated = { ...formData, id: "local-" + Math.random().toString(36).substr(2, 9) } as Reminder;
          const newReminders = [localCreated, ...reminders];
          setReminders(newReminders);
          localStorage.setItem("local_reminders_fallback", JSON.stringify(newReminders));
          showAlert("success", `Added locally: "${formData.itemName}" (Server offline)`);
        }
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
      try {
        await deleteReminder(id);
        const newReminders = reminders.filter((r) => r.id !== id);
        setReminders(newReminders);
        localStorage.setItem("local_reminders_fallback", JSON.stringify(newReminders));
        showAlert("success", "Obligation successfully removed.");
      } catch (serverErr) {
        console.warn("Server delete failed, deleting locally:", serverErr);
        const newReminders = reminders.filter((r) => r.id !== id);
        setReminders(newReminders);
        localStorage.setItem("local_reminders_fallback", JSON.stringify(newReminders));
        showAlert("success", "Obligation removed locally (Server offline).");
      }
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

      const params = {
        expiryDate: newExpiry,
        renewalDate: newRenewal || "",
        notes: notes,
        status: "Active" as const, // Reset status back to Active / Healthy
        renewalHistory: updatedHistory
      };

      try {
        const updated = await updateReminder(id, params);
        const newReminders = reminders.map((r) => (r.id === id ? updated : r));
        setReminders(newReminders);
        localStorage.setItem("local_reminders_fallback", JSON.stringify(newReminders));
        showAlert("success", "Obligation successfully renewed!");
      } catch (serverErr) {
        console.warn("Server renew failed, renewing locally:", serverErr);
        const localUpdated = { ...existing, ...params } as Reminder;
        const newReminders = reminders.map((r) => (r.id === id ? localUpdated : r));
        setReminders(newReminders);
        localStorage.setItem("local_reminders_fallback", JSON.stringify(newReminders));
        showAlert("success", "Obligation renewed locally (Server offline).");
      }
    } catch (err) {
      console.error("Quick renew error:", err);
      showAlert("error", "Failed to perform quick renewal on obligation.");
    }
  };

  // 4. SAVE CONFIG (Rules and categories)
  const handleSaveConfig = async (newConfig: GlobalConfig) => {
    try {
      try {
        const saved = await updateGlobalConfig(newConfig);
        setConfig(saved);
        localStorage.setItem("local_config_fallback", JSON.stringify(saved));
        showAlert("success", "Saved global notification rules and category list.");
      } catch (serverErr) {
        console.warn("Server config save failed, saving locally:", serverErr);
        setConfig(newConfig);
        localStorage.setItem("local_config_fallback", JSON.stringify(newConfig));
        showAlert("success", "Saved global config locally (Server offline).");
      }
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
    <div className="min-h-screen bg-[#F8F9FA] text-[#1F2937] font-sans antialiased flex">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar navigation */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0F1F3D] border-r border-[#1E2E4A]/30 flex flex-col transition-transform duration-300 transform md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Header Branding */}
        <div className="h-16 flex items-center px-6 border-b border-[#1E2E4A]/40 bg-[#0B172E]">
          <span className="text-sm font-bold text-white tracking-wide">SyncAI Consultancy Pvt. Ltd.</span>
        </div>

        {/* Navigation Items list */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "calendar", label: "Calendar", icon: Calendar },
            { id: "add", label: "Add Obligation", icon: Plus },
            { id: "upload", label: "Excel Import", icon: Upload },
            { id: "rules", label: "Alert Rules", icon: Sliders },
            { id: "logs", label: "Logs & Simulation", icon: History },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as ActiveTab);
                  setEditingReminder(null);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all relative ${
                  isActive
                    ? "bg-[#1E2E4A]/80 text-white border-l-4 border-[#0EA5B7] pl-3"
                    : "text-gray-300 hover:text-white hover:bg-[#1E2E4A]/30 pl-4"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#0EA5B7]" : "text-gray-400 group-hover:text-white"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with system status */}
        <div className="p-4 bg-[#0B172E] border-t border-[#1E2E4A]/40">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-2 h-2 rounded-full bg-[#0EA5B7] animate-pulse"></div>
            <span className="text-[10px] font-bold text-[#0EA5B7]/85 tracking-wider uppercase">System Status: Ready</span>
          </div>
        </div>
      </aside>

      {/* Main layout container (Right Panel) */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 bg-gradient-to-r from-[#0F1F3D] to-[#0EA5B7] flex items-center justify-between px-4 sm:px-6 shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-white rounded-lg md:hidden hover:bg-white/10 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-white tracking-wide md:hidden whitespace-nowrap">
              SyncAI Consultancy Pvt. Ltd.
            </span>
          </div>

          {/* Glassy Search bar in the center */}
          <div className="flex-1 max-w-md mx-4 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/60" />
            <input
              type="text"
              placeholder="Search obligations, notes..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (activeTab !== "dashboard") {
                  setActiveTab("dashboard");
                }
              }}
              className="w-full pl-9 pr-4 py-1.5 bg-white/15 border border-white/20 rounded-lg text-xs text-white placeholder:text-white/60 focus:outline-none focus:ring-1 focus:ring-white/40 focus:bg-white/25 transition-all"
            />
          </div>

          {/* Right side items */}
          <div className="flex items-center gap-3 text-white">
            {/* Notification Bell */}
            <div className="relative cursor-pointer hover:bg-white/10 p-2 rounded-full transition-colors" onClick={() => setActiveTab("logs")}>
              <Bell className="w-4 h-4" />
              {reminders.filter(r => {
                const d = getDaysRemainingLocal(r.expiryDate);
                return d <= 7 && r.status !== "Expired";
              }).length > 0 && (
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </div>

            {/* Profile Chip */}
            <div className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 py-1 pl-1.5 pr-3 rounded-full cursor-pointer transition-colors">
              <div className="w-6 h-6 rounded-full bg-[#0F1F3D] text-[#0EA5B7] flex items-center justify-center font-bold text-[10px] border border-white/25">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-bold tracking-wide hidden sm:inline text-white/90">Pranav K.</span>
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

        {/* Main Content Area */}
        <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
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
    </div>
  );
}
