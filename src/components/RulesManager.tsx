import React, { useState, useEffect } from "react";
import { Check, Settings, ShieldAlert, Plus, Trash2, RotateCcw, Save, AlertCircle, Upload, Image as ImageIcon, Bot } from "lucide-react";
import { GlobalConfig, ReminderRuleInterval, RULE_LABELS } from "../types";

interface RulesManagerProps {
  config: GlobalConfig;
  onSaveConfig: (newConfig: GlobalConfig) => Promise<void>;
  usedCategories: string[]; // List of categories currently in use (so we warning-guard deletion)
  chatbotLogo: string;
  onLogoChange: (newLogo: string) => void;
}

const RULE_OPTIONS: { value: ReminderRuleInterval; label: string; desc: string }[] = [
  { 
    value: "on_expiry", 
    label: RULE_LABELS.on_expiry, 
    desc: "Dispatches a final, critical notification directly on the day of the obligation's expiration date." 
  },
  { 
    value: "one_week_before", 
    label: RULE_LABELS.one_week_before, 
    desc: "Alerts the owner exactly 7 days in advance, providing optimal time for final action and filings." 
  },
  { 
    value: "one_month_before", 
    label: RULE_LABELS.one_month_before, 
    desc: "Sends an early advance warning 30 days prior to expiry, useful for complex compliance filings." 
  },
  { 
    value: "monthly_first", 
    label: RULE_LABELS.monthly_first, 
    desc: "Sends a status summary update on the 1st of every month for all non-expired, active obligations." 
  },
];

export default function RulesManager({ config, onSaveConfig, usedCategories, chatbotLogo, onLogoChange }: RulesManagerProps) {
  const [defaultRules, setDefaultRules] = useState<ReminderRuleInterval[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryRenewalPeriods, setCategoryRenewalPeriods] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSandboxDisabled, setIsSandboxDisabled] = useState(false);

  // Load from props
  useEffect(() => {
    if (config) {
      const rules = config.defaultRules || [];
      setDefaultRules(rules.filter((r) => r !== ("disable_sandbox_redirect" as any)));
      setIsSandboxDisabled(rules.includes("disable_sandbox_redirect" as any));
      setCategories(config.categories || []);
      setCategoryRenewalPeriods(config.categoryRenewalPeriods || {});
    }
  }, [config]);

  const handleToggleRule = (rule: ReminderRuleInterval) => {
    if (defaultRules.includes(rule)) {
      setDefaultRules(defaultRules.filter((r) => r !== rule));
    } else {
      setDefaultRules([...defaultRules, rule]);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const cleanCat = newCategory.trim();
    if (!cleanCat) return;

    if (categories.map((c) => c.toLowerCase()).includes(cleanCat.toLowerCase())) {
      setErrorMsg(`"${cleanCat}" already exists in categories.`);
      return;
    }

    setCategories([...categories, cleanCat]);
    setCategoryRenewalPeriods({
      ...categoryRenewalPeriods,
      [cleanCat]: "1 year"
    });
    setNewCategory("");
  };

  const handleDeleteCategory = (catToDelete: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    // Check if the category is in use
    const isUsed = usedCategories.some(
      (c) => c.toLowerCase() === catToDelete.toLowerCase()
    );

    if (isUsed) {
      setErrorMsg(`Cannot delete "${catToDelete}" because it is currently assigned to one or more obligations. Please reassign those items first.`);
      return;
    }

    setCategories(categories.filter((c) => c !== catToDelete));
    const updatedPeriods = { ...categoryRenewalPeriods };
    delete updatedPeriods[catToDelete];
    setCategoryRenewalPeriods(updatedPeriods);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (defaultRules.length === 0) {
      setErrorMsg("Please select at least one default notification rule trigger.");
      setIsSaving(false);
      return;
    }

    if (categories.length === 0) {
      setErrorMsg("You must have at least one obligation category defined.");
      setIsSaving(false);
      return;
    }

    try {
      const finalRules = [...defaultRules];
      if (isSandboxDisabled) {
        finalRules.push("disable_sandbox_redirect" as any);
      }
      await onSaveConfig({
        defaultRules: finalRules,
        categories,
        categoryRenewalPeriods
      });
      setSuccessMsg("Global notification rules and category defaults successfully saved.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const rules = config.defaultRules || [];
    setDefaultRules(rules.filter((r) => r !== ("disable_sandbox_redirect" as any)));
    setIsSandboxDisabled(rules.includes("disable_sandbox_redirect" as any));
    setCategories(config.categories || []);
    setCategoryRenewalPeriods(config.categoryRenewalPeriods || {});
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="space-y-6" id="rules-manager-screen">
      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700 flex items-center gap-2.5">
          <Check className="w-5 h-5 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Default Notification Rules</h3>
              <p className="text-xs text-gray-500 mt-0.5">Determine standard triggers for dispatching automated alert emails.</p>
            </div>
          </div>

          <div className="space-y-4">
            {RULE_OPTIONS.map((opt) => {
              const isSelected = defaultRules.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleToggleRule(opt.value)}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer select-none flex items-start gap-3 ${
                    isSelected
                      ? "border-blue-100 bg-blue-50/20"
                      : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-gray-800">{opt.label}</span>
                    <span className="block text-[11px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                      {opt.desc}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Email Routing & Sandbox Section */}
          <div className="border-t border-gray-100 pt-5 mt-5 space-y-3">
            <h4 className="text-xs font-semibold text-gray-900">Email Routing & Sandbox Routing</h4>
            <div
              onClick={() => setIsSandboxDisabled(!isSandboxDisabled)}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer select-none flex items-start gap-3 ${
                isSandboxDisabled
                  ? "border-amber-100 bg-amber-50/10"
                  : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <div
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                  isSandboxDisabled
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-white border-gray-300"
                }`}
              >
                {isSandboxDisabled && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div>
                <span className="block text-xs font-semibold text-gray-800">Disable Sandbox Redirect (Production Email Mode)</span>
                <span className="block text-[11px] text-gray-400 mt-1 leading-relaxed">
                  If enabled, emails will be sent directly to the actual recipient's email address instead of being redirected to <strong>pranavk.aconsultancy@gmail.com</strong>. Useful once a verified custom domain is configured in Resend.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 flex flex-col space-y-4">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
            <Settings className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Editable Category List</h3>
              <p className="text-xs text-gray-500 mt-0.5">Modify available tags for categorizing obligations.</p>
            </div>
          </div>

          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Add new category (e.g. Licensing)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs border border-blue-700 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </form>

          {/* Categories List Container */}
          <div className="flex-1 overflow-y-auto max-h-[300px] border border-gray-100 rounded-lg divide-y divide-gray-100">
            {categories.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-400 italic">No categories defined.</p>
            ) : (
              categories.map((cat) => {
                const isUsed = usedCategories.some(
                  (c) => c.toLowerCase() === cat.toLowerCase()
                );
                const currentPeriod = categoryRenewalPeriods[cat] || "1 year";
                const standardOptions = ["1 month", "2 months", "3 months", "6 months", "1 year", "2 years"];
                const isCustom = !standardOptions.includes(currentPeriod);

                return (
                  <div key={cat} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-gray-50/50 gap-2 sm:gap-4">
                    <span className="text-xs font-bold text-gray-800 truncate sm:w-1/3" title={cat}>
                      {cat}
                    </span>
                    
                    {/* Renewal Period Selection Controls */}
                    <div className="flex items-center gap-1.5 flex-1 justify-start sm:justify-end">
                      <span className="text-[10px] text-gray-400 font-medium">Renewal:</span>
                      <select
                        value={isCustom ? "custom" : currentPeriod}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") {
                            setCategoryRenewalPeriods({
                              ...categoryRenewalPeriods,
                              [cat]: "12 months"
                            });
                          } else {
                            setCategoryRenewalPeriods({
                              ...categoryRenewalPeriods,
                              [cat]: val
                            });
                          }
                        }}
                        className="px-2 py-1 border border-gray-200 rounded text-[11px] text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="1 month">1 month</option>
                        <option value="2 months">2 months</option>
                        <option value="3 months">3 months</option>
                        <option value="6 months">6 months</option>
                        <option value="1 year">1 year</option>
                        <option value="2 years">2 years</option>
                        <option value="custom">Custom...</option>
                      </select>

                      {isCustom && (
                        <input
                          type="text"
                          value={currentPeriod}
                          placeholder="e.g. 18 months"
                          onChange={(e) => {
                            setCategoryRenewalPeriods({
                              ...categoryRenewalPeriods,
                              [cat]: e.target.value
                            });
                          }}
                          className="w-24 px-2 py-1 border border-gray-200 rounded text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      className={`p-1 rounded-md transition-colors shrink-0 ${
                        isUsed
                          ? "text-gray-300 hover:bg-transparent cursor-not-allowed"
                          : "text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      }`}
                      title={isUsed ? "Category is in use by obligations" : "Delete category"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chatbot Customization Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 flex flex-col space-y-4">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
            <Bot className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Chatbot Brand Identity</h3>
              <p className="text-xs text-gray-500 mt-0.5">Customize the logo shown next to your AI Assistant's messages.</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              {/* Logo Preview and Initials Placeholder */}
              <div className="flex items-center gap-4">
                {chatbotLogo ? (
                  <img
                    src={chatbotLogo}
                    alt="Chatbot Custom Logo"
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200 shadow-xs bg-gray-50"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xl flex items-center justify-center shadow-xs">
                    CB
                  </div>
                )}
                <div className="space-y-1">
                  <span className="block text-xs font-bold text-gray-800">
                    {chatbotLogo ? "Custom Logo Uploaded" : "Using Default Initials"}
                  </span>
                  <span className="block text-[11px] text-gray-400 leading-relaxed">
                    Upload an image to customize the chatbot avatar, or clear it to use the neutral placeholder (CB).
                  </span>
                </div>
              </div>
            </div>

            {/* Upload Action and Clear Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs border border-blue-700 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Upload New Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === "string") {
                          onLogoChange(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
              </label>

              {chatbotLogo && (
                <button
                  type="button"
                  onClick={() => onLogoChange("")}
                  className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-red-600 hover:text-red-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset Logo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-xs">
        <span className="text-xs text-gray-400 font-medium">
          Note: Rules override is available on individual obligations.
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Configuration
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs border border-blue-700 cursor-pointer transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "Saving..." : "Save Config Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
