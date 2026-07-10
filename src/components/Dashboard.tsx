import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  Plus, 
  Mail, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  ShieldAlert, 
  FileSpreadsheet,
  X,
  Calendar,
  Save,
  BellRing,
  ExternalLink,
  User,
  Info
} from "lucide-react";
import { Reminder, GlobalConfig } from "../types";

interface DashboardProps {
  reminders: Reminder[];
  categories: string[];
  config: GlobalConfig;
  onAddNew: () => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => Promise<void>;
  onQuickRenew: (id: string, newExpiry: string, newRenewal: string, notes: string, historyEntry?: any) => Promise<void>;
  onSaveDirect: (formData: Omit<Reminder, "id">) => Promise<void>;
  onAddCategory: (category: string) => void;
}

type SortField = "itemName" | "category" | "responsibleName" | "expiryDate" | "status";
type SortOrder = "asc" | "desc";

// Helper function to calculate new expiry date based on standard periods
function calculateNewExpiry(currentExpiryStr: string, periodStr: string): string {
  if (!currentExpiryStr) return "";
  const parts = currentExpiryStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return currentExpiryStr;
  
  const [y, m, d] = parts;
  const expiryDate = new Date(y, m - 1, d);
  if (isNaN(expiryDate.getTime())) return currentExpiryStr;

  const cleanPeriod = (periodStr || "1 year").toLowerCase().trim();

  if (cleanPeriod.includes("year")) {
    const years = parseInt(cleanPeriod) || 1;
    expiryDate.setFullYear(expiryDate.getFullYear() + years);
  } else if (cleanPeriod.includes("month")) {
    const months = parseInt(cleanPeriod) || 1;
    expiryDate.setMonth(expiryDate.getMonth() + months);
  } else if (cleanPeriod.includes("week")) {
    const weeks = parseInt(cleanPeriod) || 1;
    expiryDate.setDate(expiryDate.getDate() + (weeks * 7));
  } else if (cleanPeriod.includes("day")) {
    const days = parseInt(cleanPeriod) || 30;
    expiryDate.setDate(expiryDate.getDate() + days);
  } else {
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  }

  const ny = expiryDate.getFullYear();
  const nm = String(expiryDate.getMonth() + 1).padStart(2, "0");
  const nd = String(expiryDate.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

export default function Dashboard({
  reminders,
  categories,
  config,
  onAddNew,
  onEdit,
  onDelete,
  onQuickRenew,
  onSaveDirect,
  onAddCategory
}: DashboardProps) {
  // Search & Filtering States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  
  // Sorting States
  const [sortField, setSortField] = useState<SortField>("expiryDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Quick Renew Modal State
  const [quickRenewItem, setQuickRenewItem] = useState<Reminder | null>(null);
  const [quickNewExpiry, setQuickNewExpiry] = useState("");
  const [quickNewRenewal, setQuickNewRenewal] = useState("");
  const [quickNewNotes, setQuickNewNotes] = useState("");
  const [quickRenewBy, setQuickRenewBy] = useState("Pranav K");
  const [quickRenewalPeriodText, setQuickRenewalPeriodText] = useState("1 year");
  const [isRenewing, setIsRenewing] = useState(false);

  // Expanded Row State
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);

  const toggleRowExpanded = (id: string) => {
    if (expandedRowIds.includes(id)) {
      setExpandedRowIds(expandedRowIds.filter(x => x !== id));
    } else {
      setExpandedRowIds([...expandedRowIds, id]);
    }
  };

  // "+ Add New Reminder" Quick Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPerson, setNewPerson] = useState("Pranav K");
  const [newEmail, setNewEmail] = useState("pranavk.aconsultancy@gmail.com");
  const [newExpiry, setNewExpiry] = useState("");
  const [newRenewal, setNewRenewal] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [customCatInput, setCustomCatInput] = useState("");
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // On-Open Notification States
  const [showOnOpenPopup, setShowOnOpenPopup] = useState(true);
  const [highlightedReminderIds, setHighlightedReminderIds] = useState<string[]>([]);

  // Reset category selection when open modal
  useEffect(() => {
    if (categories.length > 0 && !newCategory) {
      setNewCategory(categories[0]);
    }
  }, [categories, newCategory]);

  // Derive unique responsible persons list dynamically
  const uniquePersons = useMemo(() => {
    const names = reminders
      .map((r) => r.responsibleName.trim())
      .filter((n) => n !== "");
    return Array.from(new Set(names)).sort();
  }, [reminders]);

  // Utility to compute days remaining
  const getDaysRemainingLocal = (expiryStr: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryStr);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Find overdue or expiring <= 10 days reminders automatically for page load check
  const urgentReminders = useMemo(() => {
    return reminders.filter((r) => {
      const days = getDaysRemainingLocal(r.expiryDate);
      return days < 0 || (days >= 0 && days <= 10);
    });
  }, [reminders]);

  // Summary Metrics Calculations
  const metrics = useMemo(() => {
    let overdueCount = 0;
    let soonCount = 0;
    let activeCount = 0;

    reminders.forEach((r) => {
      const days = getDaysRemainingLocal(r.expiryDate);
      if (days < 0 || r.status === "Expired") {
        overdueCount++;
      } else if (days <= 30) {
        soonCount++;
      } else {
        activeCount++;
      }
    });

    return {
      total: reminders.length,
      overdue: overdueCount,
      soon: soonCount,
      active: activeCount
    };
  }, [reminders]);

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filter & Sort Reminders List
  const processedReminders = useMemo(() => {
    return reminders
      .filter((r) => {
        // Search text matching Name, Person, Email, Notes
        const matchesSearch =
          searchTerm === "" ||
          r.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.responsibleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.responsibleEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.notes.toLowerCase().includes(searchTerm.toLowerCase());

        // Dropdown Category match
        const matchesCategory = selectedCategory === "" || r.category === selectedCategory;

        // Dropdown Person match
        const matchesPerson = selectedPerson === "" || r.responsibleName === selectedPerson;

        // Dropdown Status match
        const matchesStatus =
          selectedStatus === "" ||
          (selectedStatus === "Overdue" && (getDaysRemainingLocal(r.expiryDate) < 0 || r.status === "Expired")) ||
          (selectedStatus === "Expiring Soon" && getDaysRemainingLocal(r.expiryDate) >= 0 && getDaysRemainingLocal(r.expiryDate) <= 30 && r.status !== "Expired") ||
          (selectedStatus === "Active" && getDaysRemainingLocal(r.expiryDate) > 30 && r.status !== "Expired");

        return matchesSearch && matchesCategory && matchesPerson && matchesStatus;
      })
      .sort((a, b) => {
        let valA = a[sortField] || "";
        let valB = b[sortField] || "";

        if (sortField === "expiryDate") {
          const timeA = new Date(valA).getTime() || 0;
          const timeB = new Date(valB).getTime() || 0;
          return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
        }

        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [reminders, searchTerm, selectedCategory, selectedPerson, selectedStatus, sortField, sortOrder]);

  const handleOpenQuickRenew = (reminder: Reminder) => {
    setQuickRenewItem(reminder);
    
    // Determine renewal period
    const standardPeriod = reminder.renewalPeriodOverride || (config?.categoryRenewalPeriods && config.categoryRenewalPeriods[reminder.category]) || "1 year";
    setQuickRenewalPeriodText(standardPeriod);

    // Calculate new expiry from current expiry
    const newExpiryCalculated = calculateNewExpiry(reminder.expiryDate, standardPeriod);
    setQuickNewExpiry(newExpiryCalculated);

    // Default new renewal filing date to today's date
    const todayStr = new Date().toISOString().split("T")[0];
    setQuickNewRenewal(todayStr);

    // Default renewed by to Pranav K
    setQuickRenewBy("Pranav K");
    
    // Set notes field (start blank for appending new notes)
    setQuickNewNotes("");
  };

  const submitQuickRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRenewItem || !quickNewExpiry) return;
    setIsRenewing(true);
    try {
      const historyEntry = {
        oldExpiryDate: quickRenewItem.expiryDate,
        newExpiryDate: quickNewExpiry,
        renewedBy: quickRenewBy || "Pranav K",
        renewedOn: new Date().toISOString().split("T")[0]
      };
      
      // Append quick renewal notes if any
      let finalNotes = quickRenewItem.notes;
      if (quickNewNotes.trim()) {
        finalNotes = finalNotes 
          ? `${finalNotes}\n[Renewed on ${historyEntry.renewedOn} by ${historyEntry.renewedBy}: ${quickNewNotes.trim()}]`
          : `[Renewed on ${historyEntry.renewedOn} by ${historyEntry.renewedBy}: ${quickNewNotes.trim()}]`;
      }

      await onQuickRenew(quickRenewItem.id, quickNewExpiry, quickNewRenewal, finalNotes, historyEntry);
      setQuickRenewItem(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRenewing(false);
    }
  };

  // Quick Add Reminder Modal Submission
  const submitQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const finalName = newName.trim();
    if (!finalName) {
      setAddError("Obligation Name is required.");
      return;
    }
    if (!newExpiry) {
      setAddError("Expiry / Due Date is required.");
      return;
    }

    const finalCategory = showCustomCatInput ? customCatInput.trim() : newCategory;
    if (!finalCategory) {
      setAddError("Please specify a category.");
      return;
    }

    setIsSavingNew(true);

    try {
      // If custom category was typed, register it on the config list
      if (showCustomCatInput && customCatInput.trim()) {
        await onAddCategory(customCatInput.trim());
      }

      let initialStatus: "Active" | "Expired" = "Active";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const chosenExpiry = new Date(newExpiry);
      chosenExpiry.setHours(0, 0, 0, 0);
      if (chosenExpiry < today) {
        initialStatus = "Expired";
      }

      await onSaveDirect({
        itemName: finalName,
        category: finalCategory,
        responsibleName: newPerson.trim() || "Pranav K",
        responsibleEmail: newEmail.trim() || "pranavk.aconsultancy@gmail.com",
        expiryDate: newExpiry,
        renewalDate: newRenewal || "",
        notes: newNotes.trim(),
        status: initialStatus
      });

      // Clear input fields and close modal
      setNewName("");
      setNewExpiry("");
      setNewRenewal("");
      setNewNotes("");
      setCustomCatInput("");
      setShowCustomCatInput(false);
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Quick add save error:", err);
      setAddError(err.message || "Failed to save the new obligation.");
    } finally {
      setIsSavingNew(false);
    }
  };

  // View All action for automatic load notifications
  const handleViewAllUrgent = () => {
    const ids = urgentReminders.map(r => r.id);
    setHighlightedReminderIds(ids);
    
    // Smooth scroll to the obligations table container
    const tableContainer = document.getElementById("obligations-table-section");
    if (tableContainer) {
      tableContainer.scrollIntoView({ behavior: "smooth" });
    }
  };

  const clearHighlights = () => {
    setHighlightedReminderIds([]);
  };

  const handleRowColorClass = (expiryDateStr: string, status: string, id: string) => {
    const isHighlighted = highlightedReminderIds.includes(id);
    if (isHighlighted) {
      return "bg-amber-50/70 hover:bg-amber-50 border-y-2 border-amber-300 ring-2 ring-amber-300 shadow-sm font-semibold animate-pulse-subtle";
    }

    const days = getDaysRemainingLocal(expiryDateStr);
    if (days < 0 || status === "Expired") {
      return "border-l-4 border-l-red-500 hover:bg-red-50/15"; // Overdue
    } else if (days <= 30) {
      return "border-l-4 border-l-amber-500 hover:bg-amber-50/15"; // Due Soon
    } else {
      return "border-l-4 border-l-green-500 hover:bg-green-50/10"; // Healthy / Active
    }
  };

  return (
    <div className="space-y-6" id="dashboard-screen">
      
      {/* 1. ON-OPEN / ON-REFRESH NOTIFICATIONS PANEL */}
      {showOnOpenPopup && urgentReminders.length > 0 && (
        <div className="bg-red-50/95 border border-red-200 rounded-xl p-4 shadow-sm animate-fade-in flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0 mt-0.5">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-red-950 uppercase tracking-wide flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                Action Required: {urgentReminders.length} Overdue or Expiring Obligations Found!
              </h3>
              <p className="text-xs text-red-900 leading-relaxed">
                The following business compliance deadlines require your immediate intervention:
              </p>
              
              {/* Short list of urgent items */}
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2">
                {urgentReminders.slice(0, 6).map(r => {
                  const days = getDaysRemainingLocal(r.expiryDate);
                  const isOverdue = days < 0;
                  return (
                    <div key={r.id} className="p-2 bg-white/75 border border-red-100 rounded-lg text-[11px] flex items-center justify-between gap-2 shadow-2xs">
                      <div className="truncate">
                        <span className="font-bold text-gray-900 block truncate">{r.itemName}</span>
                        <span className="text-gray-500 font-medium">{r.category} • Owner: {r.responsibleName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-black whitespace-nowrap text-[10px] ${
                        isOverdue 
                          ? "bg-red-100 text-red-700" 
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {isOverdue ? `Overdue by ${Math.abs(days)}d` : `${days}d left`}
                      </span>
                    </div>
                  );
                })}
                {urgentReminders.length > 6 && (
                  <div className="p-2 bg-white/50 border border-red-50 rounded-lg text-[10px] text-gray-500 flex items-center justify-center italic">
                    + {urgentReminders.length - 6} more obligations
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-start">
            <button
              onClick={handleViewAllUrgent}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              View All
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowOnOpenPopup(false)}
              className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors cursor-pointer"
              title="Dismiss warning popup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Key Performance Cards / Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Obligations */}
        <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Obligations</span>
            <span className="block text-2xl font-black text-gray-900">{metrics.total}</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Overdue / Expired</span>
            <span className="block text-2xl font-black text-red-600">{metrics.overdue}</span>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Due soon */}
        <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Due Soon (&le; 30 Days)</span>
            <span className="block text-2xl font-black text-amber-600">{metrics.soon}</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Healthy */}
        <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active &amp; Healthy</span>
            <span className="block text-2xl font-black text-green-600">{metrics.active}</span>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Advanced Search, Filtering and Add Button Toolbar */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main search and category picker */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {/* Search Input */}
            <div className="sm:col-span-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search obligation, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-2.5 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>

            {/* Responsible Person Dropdown */}
            <div className="relative">
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                <option value="">All Owners</option>
                {uniquePersons.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-2.5 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>

            {/* Criticality Status Dropdown */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="Overdue">🔴 Overdue / Expired</option>
                <option value="Expiring Soon">🟡 Expiring Soon</option>
                <option value="Active">🟢 Active / Healthy</option>
              </select>
              <Filter className="absolute right-3 top-2.5 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons: Add New and Old Add Trigger */}
          <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-auto">
            {/* Direct Dashboard Quick Add (REMAINING ON DASHBOARD) */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs border border-blue-700 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              + Add New Reminder
            </button>
          </div>
        </div>
      </div>

      {/* 4. Active Highlight Control */}
      {highlightedReminderIds.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between text-xs text-amber-900 animate-fade-in">
          <span className="font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-500 shrink-0" />
            Filtering/Highlighting {highlightedReminderIds.length} urgent obligations expiring within 10 days.
          </span>
          <button
            onClick={clearHighlights}
            className="text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-white hover:bg-amber-100/50 px-2 py-1 rounded border border-amber-200 cursor-pointer transition-colors"
          >
            Clear Highlight
          </button>
        </div>
      )}

      {/* 5. Core Obligations Structured Table */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden" id="obligations-table-section">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th
                  onClick={() => handleSort("itemName")}
                  className="py-3.5 px-5 cursor-pointer hover:bg-gray-100/50 hover:text-gray-950 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Name
                    {sortField === "itemName" && (sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("category")}
                  className="py-3.5 px-4 cursor-pointer hover:bg-gray-100/50 hover:text-gray-950 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Category
                    {sortField === "category" && (sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("expiryDate")}
                  className="py-3.5 px-4 cursor-pointer hover:bg-gray-100/50 hover:text-gray-950 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Expiry Date
                    {sortField === "expiryDate" && (sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                  </div>
                </th>
                <th className="py-3.5 px-4">
                  Days Remaining
                </th>
                <th
                  onClick={() => handleSort("responsibleName")}
                  className="py-3.5 px-4 cursor-pointer hover:bg-gray-100/50 hover:text-gray-950 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Responsible Person
                    {sortField === "responsibleName" && (sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="py-3.5 px-4 cursor-pointer hover:bg-gray-100/50 hover:text-gray-950 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Status
                    {sortField === "status" && (sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                  </div>
                </th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {processedReminders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-gray-400 italic bg-gray-50/10">
                    No active obligations found matching the search criteria.
                  </td>
                </tr>
              ) : (
                processedReminders.map((r) => {
                  const days = getDaysRemainingLocal(r.expiryDate);
                  const isOverdue = days < 0 || r.status === "Expired";
                  const isSoon = days >= 0 && days <= 30;
                  const isHighlighted = highlightedReminderIds.includes(r.id);
                  const isExpanded = expandedRowIds.includes(r.id);

                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        className={`transition-colors duration-150 group border-b border-gray-100/50 ${
                          isHighlighted 
                            ? "bg-amber-50 hover:bg-amber-100/80 border-l-4 border-l-amber-500 text-amber-950 font-medium" 
                            : isExpanded
                            ? "bg-gray-50/30"
                            : handleRowColorClass(r.expiryDate, r.status, r.id)
                        }`}
                      >
                        {/* Name & Notes with Expander chevron */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => toggleRowExpanded(r.id)}
                              className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-blue-600 transition-colors shrink-0 cursor-pointer"
                              title={isExpanded ? "Collapse Details" : "Expand Details"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                              ) : (
                                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                              )}
                            </button>
                            <div>
                              <div 
                                onClick={() => toggleRowExpanded(r.id)}
                                className={`font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug cursor-pointer select-none ${isHighlighted ? "text-amber-950" : ""}`}
                              >
                                {r.itemName}
                              </div>
                              {r.notes && (
                                <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-1 max-w-[280px]" title={r.notes}>
                                  {r.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Category Tag */}
                        <td className="py-3.5 px-4 text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200/50">
                            {r.category}
                          </span>
                        </td>

                        {/* Expiry Date */}
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-gray-800">
                          {r.expiryDate}
                        </td>

                        {/* Days Remaining (Auto calculated & color-coded) */}
                        <td className="py-3.5 px-4 text-xs font-bold">
                          {isOverdue ? (
                            <span className="text-red-600">
                              Overdue by {Math.abs(days)} day{Math.abs(days) !== 1 ? "s" : ""}
                            </span>
                          ) : isSoon ? (
                            <span className="text-amber-600">
                              {days} day{days !== 1 ? "s" : ""} left
                            </span>
                          ) : (
                            <span className="text-green-600">
                              {days} day{days !== 1 ? "s" : ""} left
                            </span>
                          )}
                        </td>

                        {/* Responsible Person with quick email icon */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-800 text-xs">{r.responsibleName}</div>
                          <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[150px]">{r.responsibleEmail}</span>
                          </div>
                        </td>

                        {/* Criticality Badge */}
                        <td className="py-3.5 px-4">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" /> Expired
                            </span>
                          ) : isSoon ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" /> Due Soon
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>

                        {/* Actions Buttons with prominent Renew */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2.5 opacity-95 group-hover:opacity-100 transition-all">
                            {/* Prominent Renew Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenQuickRenew(r)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                                isOverdue
                                  ? "bg-red-600 border-red-700 text-white hover:bg-red-700"
                                  : isSoon
                                  ? "bg-amber-500 border-amber-600 text-white hover:bg-amber-600"
                                  : "bg-white border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                              }`}
                              title="Renew this obligation"
                            >
                              <RefreshCw className="w-3 h-3 shrink-0" />
                              Renew
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => onEdit(r)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 border border-transparent hover:border-gray-200 rounded-lg transition-colors cursor-pointer"
                              title="Edit Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to stop tracking "${r.itemName}"?`)) {
                                  onDelete(r.id);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 rounded-lg transition-colors cursor-pointer"
                              title="Stop Tracking"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Details Section */}
                      {isExpanded && (
                        <tr className="bg-gray-50/40">
                          <td colSpan={7} className="px-6 py-4.5 border-t border-b border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-700 animate-fade-in">
                              {/* Left Column: Full description and notification rules overrides */}
                              <div className="space-y-4">
                                <div>
                                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Detailed Notes / Descriptions</span>
                                  <div className="bg-white p-3 rounded-lg border border-gray-100 whitespace-pre-line text-xs text-gray-800 leading-relaxed font-medium">
                                    {r.notes || <span className="text-gray-400 italic font-normal">No custom notes added to this obligation.</span>}
                                  </div>
                                </div>
                                
                                <div>
                                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Notification Alerts</span>
                                  <div className="flex flex-wrap gap-2">
                                    {r.rulesOverride ? (
                                      r.rulesOverride.map(rule => (
                                        <span key={rule} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-100 text-[11px] font-bold">
                                          ⚠️ {rule.replace(/_/g, " ")}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-100 text-[11px] font-bold">
                                        🌐 Inheriting Global Rules
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Historical renewals log */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Renewal History Audit Log</span>
                                  {r.renewalPeriodOverride && (
                                    <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md font-bold">
                                      Period Override: {r.renewalPeriodOverride}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-100 max-h-[160px] overflow-y-auto shadow-2xs">
                                  {!r.renewalHistory || r.renewalHistory.length === 0 ? (
                                    <p className="p-4 text-center text-xs text-gray-400 italic">No previous renewal events logged for this obligation.</p>
                                  ) : (
                                    r.renewalHistory.slice().reverse().map((log, index) => (
                                      <div key={index} className="p-3 text-xs flex flex-col gap-1 hover:bg-gray-50/30">
                                        <div className="flex items-center justify-between font-semibold text-gray-800">
                                          <span className="text-blue-600">Renewed by {log.renewedBy}</span>
                                          <span className="font-mono text-gray-400 text-[10px]">{log.renewedOn}</span>
                                        </div>
                                        <div className="text-[11px] text-gray-500 leading-normal flex items-center gap-1">
                                          <span>Expiry Extended:</span>
                                          <span className="font-mono line-through text-gray-400">{log.oldExpiryDate}</span>
                                          <span className="text-gray-400">&rarr;</span>
                                          <span className="font-mono text-green-600 font-bold">{log.newExpiryDate}</span>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. "+ Add New Reminder" Pop-up Modal Form */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900 text-sm">Create New Obligation Reminder</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitQuickAdd} className="p-5 space-y-4">
              {addError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}

              {/* Obligation Name */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Obligation Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Server AC Servicing, Trade License Renewal"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800"
                />
              </div>

              {/* Category selector */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCustomCatInput(!showCustomCatInput)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {showCustomCatInput ? "Select Existing" : "+ Create Custom"}
                  </button>
                </div>
                {showCustomCatInput ? (
                  <input
                    type="text"
                    required
                    value={customCatInput}
                    onChange={(e) => setCustomCatInput(e.target.value)}
                    placeholder="Enter new custom category name"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800 bg-white"
                  />
                ) : (
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800 bg-white cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Responsible Person & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Responsible Person
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={newPerson}
                      onChange={(e) => setNewPerson(e.target.value)}
                      placeholder="e.g. Pranav K"
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="e.g. client@example.com"
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* Expiry & Renewal dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Expiry / Due Date *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={newExpiry}
                      onChange={(e) => setNewExpiry(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Filing / Renewal Date (Optional)
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={newRenewal}
                      onChange={(e) => setNewRenewal(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Details about vendor, contract location, links, etc."
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800"
                />
              </div>

              {/* Form Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNew}
                  className="flex items-center gap-1.5 px-4.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs border border-blue-700 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingNew ? "Saving..." : "Save Obligation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Quick Renew Slide-over / Modal */}
      {quickRenewItem && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-gray-900 text-sm">Renew Obligation</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickRenewItem(null)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitQuickRenew} className="p-5 space-y-4">
              {/* Detailed Summary Banner */}
              <div className="bg-blue-50/40 rounded-xl p-3.5 text-xs border border-blue-100/40 space-y-1.5 shadow-2xs">
                <div className="font-extrabold text-gray-900 text-sm">{quickRenewItem.itemName}</div>
                <div className="text-gray-500 flex items-center gap-1.5 font-medium">
                  Category: <strong className="text-gray-700">{quickRenewItem.category}</strong>
                </div>
                <div className="text-gray-500 flex items-center gap-1.5 font-medium">
                  Current Expiry: <strong className="font-mono text-gray-700">{quickRenewItem.expiryDate}</strong>
                </div>
                <div className="text-gray-500 flex items-center gap-1.5 font-medium">
                  Standard Renewal Period: <strong className="text-blue-700 font-bold">{quickRenewalPeriodText}</strong>
                </div>
              </div>

              {/* New Expiry Date (customizable manual date picker) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  New Expiry Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={quickNewExpiry}
                    onChange={(e) => setQuickNewExpiry(e.target.value)}
                    className="w-full pl-10 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800 bg-white"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 font-semibold">
                  💡 Autocalculated from {quickRenewItem.expiryDate} using period "{quickRenewalPeriodText}"
                </p>
              </div>

              {/* New Renewal Date / Filing Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Renewal Filing Date (Defaults to Today)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={quickNewRenewal}
                    onChange={(e) => setQuickNewRenewal(e.target.value)}
                    className="w-full pl-10 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800 bg-white"
                  />
                </div>
              </div>

              {/* Renewed By Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Renewed By *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={quickRenewBy}
                    onChange={(e) => setQuickRenewBy(e.target.value)}
                    className="w-full pl-10 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800 bg-white"
                    placeholder="E.g. Pranav K"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Logged as the operator performing this action.</p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Add Audit Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={quickNewNotes}
                  onChange={(e) => setQuickNewNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800"
                  placeholder="E.g. Approved by legal / New premium paid"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setQuickRenewItem(null)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenewing}
                  className="flex items-center gap-1.5 px-4.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs border border-blue-700 cursor-pointer transition-all active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isRenewing ? "Renewing..." : "Confirm Renewal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
