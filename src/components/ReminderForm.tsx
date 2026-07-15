import React, { useState, useEffect } from "react";
import { X, Calendar, Plus, Save, RotateCcw, AlertCircle } from "lucide-react";
import { Reminder, ReminderRuleInterval, RULE_LABELS } from "../types";

interface ReminderFormProps {
  reminder: Reminder | null; // Null means Add New, non-null means Edit
  categories: string[];
  onSave: (reminderData: Omit<Reminder, "id">) => Promise<void>;
  onCancel: () => void;
  onAddCategory: (category: string) => void;
}

const RULE_OPTIONS: { value: ReminderRuleInterval; label: string }[] = [
  { value: "monthly_first", label: RULE_LABELS.monthly_first },
  { value: "one_month_before", label: RULE_LABELS.one_month_before },
  { value: "one_week_before", label: RULE_LABELS.one_week_before },
  { value: "on_expiry", label: RULE_LABELS.on_expiry },
];

export default function ReminderForm({
  reminder,
  categories,
  onSave,
  onCancel,
  onAddCategory
}: ReminderFormProps) {
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [responsibleName, setResponsibleName] = useState("Pranav K");
  const [responsibleEmail, setResponsibleEmail] = useState("pranavk.aconsultancy@gmail.com");
  const [expiryDate, setExpiryDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [status, setStatus] = useState<"Active" | "Renewed" | "Expired">("Active");
  const [notes, setNotes] = useState("");
  const [renewalPeriodOverride, setRenewalPeriodOverride] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  
  // Rules configuration
  const [useGlobalRules, setUseGlobalRules] = useState(true);
  const [rulesOverride, setRulesOverride] = useState<ReminderRuleInterval[]>([
    "one_month_before",
    "one_week_before",
    "on_expiry"
  ]);

  const [newCatInput, setNewCatInput] = useState("");
  const [showCatInput, setShowCatInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load values if editing
  useEffect(() => {
    if (reminder) {
      setItemName(reminder.itemName || "");
      setCategory(reminder.category || (categories[0] || "Payment Due"));
      setResponsibleName(reminder.responsibleName || "");
      setResponsibleEmail(reminder.responsibleEmail || "");
      setExpiryDate(reminder.expiryDate || "");
      setRenewalDate(reminder.renewalDate || "");
      setStatus(reminder.status || "Active");
      setNotes(reminder.notes || "");
      setRenewalPeriodOverride(reminder.renewalPeriodOverride || "");
      setCustomerName(reminder.customerName || "");
      setCustomerEmail(reminder.customerEmail || "");
      if (reminder.rulesOverride) {
        setUseGlobalRules(false);
        setRulesOverride(reminder.rulesOverride);
      } else {
        setUseGlobalRules(true);
      }
    } else {
      setItemName("");
      setCategory(categories[0] || "Payment Due");
      setResponsibleName("Pranav K");
      setResponsibleEmail("pranavk.aconsultancy@gmail.com");
      setExpiryDate("");
      setRenewalDate("");
      setStatus("Active");
      setNotes("");
      setRenewalPeriodOverride("");
      setCustomerName("");
      setCustomerEmail("");
      setUseGlobalRules(true);
    }
    setError(null);
  }, [reminder, categories]);

  // Handle auto-calculating status if expiry changes
  const handleExpiryChange = (dateVal: string) => {
    setExpiryDate(dateVal);
    if (dateVal) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(dateVal);
      expiry.setHours(0, 0, 0, 0);
      
      if (expiry < today) {
        setStatus("Expired");
      } else if (status === "Expired") {
        setStatus("Active");
      }
    }
  };

  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCat = newCatInput.trim();
    if (!cleanCat) return;

    if (categories.map(c => c.toLowerCase()).includes(cleanCat.toLowerCase())) {
      setError("Category already exists.");
      return;
    }

    onAddCategory(cleanCat);
    setCategory(cleanCat);
    setNewCatInput("");
    setShowCatInput(false);
    setError(null);
  };

  const handleRuleToggle = (rule: ReminderRuleInterval) => {
    if (rulesOverride.includes(rule)) {
      setRulesOverride(rulesOverride.filter(r => r !== rule));
    } else {
      setRulesOverride([...rulesOverride, rule]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!itemName.trim()) {
      setError("Item name is required.");
      return;
    }
    if (!category) {
      setError("Please select a category.");
      return;
    }
    if (!responsibleName.trim()) {
      setError("Responsible person is required.");
      return;
    }
    if (!responsibleEmail.trim()) {
      setError("Responsible email is required.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(responsibleEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!expiryDate) {
      setError("Expiry/Due date is required.");
      return;
    }

    if (customerEmail.trim() && !/\S+@\S+\.\S+/.test(customerEmail)) {
      setError("Please enter a valid customer email address.");
      return;
    }

    setIsSubmitting(true);

    const formData: Omit<Reminder, "id"> = {
      itemName: itemName.trim(),
      category,
      responsibleName: responsibleName.trim(),
      responsibleEmail: responsibleEmail.trim(),
      expiryDate,
      renewalDate: renewalDate || "",
      status,
      notes: notes.trim(),
      rulesOverride: useGlobalRules ? undefined : rulesOverride,
      renewalPeriodOverride: renewalPeriodOverride.trim() || undefined,
      customerName: customerName.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined
    };

    try {
      await onSave(formData);
    } catch (err: any) {
      setError(err.message || "Failed to save reminder details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-2xl mx-auto" id="manual-form">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            {reminder ? "Edit Obligation Details" : "Add New Obligation"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {reminder ? "Update details and specific alert rules for this obligation." : "Track a new time-sensitive contract, visa, renewal, or payment."}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Item name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            Obligation / Item Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Server Room AC Servicing, Commercial Liability Insurance"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400"
          />
        </div>

        {/* Category & Custom Category Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Category *
            </label>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-800"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCatInput(!showCatInput)}
                className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center"
                title="Add custom category"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium text-gray-800"
            >
              <option value="Active">🟢 Active / Healthy</option>
              <option value="Renewed">🔵 Renewed</option>
              <option value="Expired">🔴 Expired / Overdue</option>
            </select>
          </div>
        </div>

        {/* Inline custom category input */}
        {showCatInput && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter custom category"
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800"
            />
            <button
              type="button"
              onClick={handleAddCustomCategory}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowCatInput(false)}
              className="px-2 py-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-md text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Responsible Person */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Responsible Person Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Priya Sharma"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Responsible Person Email *
            </label>
            <input
              type="email"
              required
              placeholder="e.g. priya.s@example.com"
              value={responsibleEmail}
              onChange={(e) => setResponsibleEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Customer Information (Optional) */}
        <div className="bg-blue-50/20 p-4 rounded-xl border border-blue-100/50 space-y-3">
          <div className="flex flex-col">
            <span className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
              Also notify a customer? (optional)
            </span>
            <span className="text-[11px] text-gray-500 mt-0.5">
              Add their email if this reminder should also go to a customer, not just the responsible person.
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp / John Doe"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Customer Email (Optional)
              </label>
              <input
                type="email"
                placeholder="e.g. customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Expiry and Renewal Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Expiry / Due Date *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => handleExpiryChange(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Renewal Filing Date (Optional)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-800"
              />
            </div>
          </div>
        </div>

        {/* Renewal Period Override */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            Individual Renewal Period Override (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. 1 year, 6 months, 45 days (leave blank to use category default)"
            value={renewalPeriodOverride}
            onChange={(e) => setRenewalPeriodOverride(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400 text-gray-800"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Overrides the standard default renewal period of the selected category when clicking the "Renew" action.
          </p>
        </div>

        {/* Alert Rules Override */}
        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Notification Trigger Rules
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                Configure when alert emails will be dispatched for this specific item.
              </p>
            </div>
          </div>

          {/* Use Global Rules Switcher */}
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-2">
            <input
              type="checkbox"
              id="global-rules-chk"
              checked={useGlobalRules}
              onChange={(e) => setUseGlobalRules(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <label htmlFor="global-rules-chk" className="text-xs font-medium text-gray-600 select-none cursor-pointer">
              Inherit Global Default Alert Rules
            </label>
          </div>

          {/* Rule options checkboxes */}
          {!useGlobalRules && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {RULE_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`rule-chk-${opt.value}`}
                    checked={rulesOverride.includes(opt.value)}
                    onChange={() => handleRuleToggle(opt.value)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label
                    htmlFor={`rule-chk-${opt.value}`}
                    className="text-xs text-gray-600 select-none cursor-pointer hover:text-gray-900"
                  >
                    {opt.label}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            Notes / Vendor Details
          </label>
          <textarea
            placeholder="e.g. Quote #QT-820, Allianz Policy details, Service Engineer contact number, website login portal link"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs border border-blue-700 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Saving..." : "Save Obligation"}
          </button>
        </div>
      </form>
    </div>
  );
}
