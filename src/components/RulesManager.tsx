import React, { useState, useEffect } from "react";
import { 
  Check, 
  Settings, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Save, 
  AlertCircle, 
  Upload, 
  Bot, 
  MessageSquare, 
  Key, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  XCircle,
  Sliders,
  Tag
} from "lucide-react";
import { GlobalConfig, ReminderRuleInterval, RULE_LABELS } from "../types";
import { fetchSmsSettings, saveSmsSettings, sendTestSMS } from "../lib/api";

interface RulesManagerProps {
  config: GlobalConfig;
  onSaveConfig: (newConfig: GlobalConfig) => Promise<void>;
  usedCategories: string[]; // List of categories currently in use (so we warning-guard deletion)
  chatbotLogo: string;
  onLogoChange: (newLogo: string) => void;
  initialSubTab?: "all" | "sms" | "rules" | "categories" | "branding";
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

export default function RulesManager({ config, onSaveConfig, usedCategories, chatbotLogo, onLogoChange, initialSubTab = "sms" }: RulesManagerProps) {
  const [activeTab, setActiveTab] = useState<"all" | "sms" | "rules" | "categories" | "branding">(initialSubTab);
  const [defaultRules, setDefaultRules] = useState<ReminderRuleInterval[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryRenewalPeriods, setCategoryRenewalPeriods] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSandboxDisabled, setIsSandboxDisabled] = useState(false);

  // SMS Credentials State
  const [smsAccountSid, setSmsAccountSid] = useState("");
  const [smsAuthToken, setSmsAuthToken] = useState("");
  const [smsPhoneNumber, setSmsPhoneNumber] = useState("");
  const [smsMaskedToken, setSmsMaskedToken] = useState("");
  const [hasSmsAuthToken, setHasSmsAuthToken] = useState(false);
  const [isSmsConfigured, setIsSmsConfigured] = useState(false);
  const [smsSource, setSmsSource] = useState<string>("none");

  const [isSmsLoading, setIsSmsLoading] = useState(false);
  const [isSmsSaving, setIsSmsSaving] = useState(false);
  const [smsSuccessMsg, setSmsSuccessMsg] = useState<string | null>(null);
  const [smsErrorMsg, setSmsErrorMsg] = useState<string | null>(null);
  const [showAuthToken, setShowAuthToken] = useState(false);

  // Test SMS State
  const [testMobile, setTestMobile] = useState("+919876543210");
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Listen for navigation trigger event to jump to SMS Settings
  useEffect(() => {
    const handleOpenSms = () => setActiveTab("sms");
    window.addEventListener("open-sms-settings", handleOpenSms);
    return () => window.removeEventListener("open-sms-settings", handleOpenSms);
  }, []);

  // Load configuration from props
  useEffect(() => {
    if (config) {
      const rules = config.defaultRules || [];
      setDefaultRules(rules.filter((r) => r !== ("disable_sandbox_redirect" as any)));
      setIsSandboxDisabled(rules.includes("disable_sandbox_redirect" as any));
      setCategories(config.categories || []);
      setCategoryRenewalPeriods(config.categoryRenewalPeriods || {});
    }
  }, [config]);

  // Load SMS credentials from backend API on mount
  useEffect(() => {
    loadSmsSettings();
  }, []);

  const loadSmsSettings = async () => {
    setIsSmsLoading(true);
    try {
      const data = await fetchSmsSettings();
      setSmsAccountSid(data.accountSid || "");
      setSmsPhoneNumber(data.phoneNumber || "");
      setSmsMaskedToken(data.maskedAuthToken || "");
      setHasSmsAuthToken(data.hasAuthToken);
      setIsSmsConfigured(data.isConfigured);
      setSmsSource(data.source);
      if (data.hasAuthToken) {
        setSmsAuthToken(data.maskedAuthToken);
      }
    } catch (err: any) {
      console.warn("Failed to fetch SMS settings:", err);
    } finally {
      setIsSmsLoading(false);
    }
  };

  const handleSaveSmsSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSmsSaving(true);
    setSmsSuccessMsg(null);
    setSmsErrorMsg(null);
    setTestSmsResult(null);

    try {
      const res = await saveSmsSettings({
        accountSid: smsAccountSid,
        authToken: smsAuthToken,
        phoneNumber: smsPhoneNumber
      });

      setSmsSuccessMsg("Twilio connected successfully! Credentials verified against Twilio API.");
      setSmsMaskedToken(res.maskedAuthToken);
      setSmsAuthToken(res.maskedAuthToken);
      setHasSmsAuthToken(res.hasAuthToken);
      setIsSmsConfigured(res.isConfigured);
      setSmsSource(res.source);
    } catch (err: any) {
      setSmsErrorMsg(err.message || "Failed to validate and save Twilio credentials.");
    } finally {
      setIsSmsSaving(false);
    }
  };

  const isRulesSameNumber = React.useMemo(() => {
    if (!testMobile || !testMobile.trim() || !smsPhoneNumber || !smsPhoneNumber.trim()) {
      return false;
    }
    const cleanTo = testMobile.replace(/\D/g, "");
    const cleanFrom = smsPhoneNumber.replace(/\D/g, "");
    if (!cleanTo || !cleanFrom) return false;
    return (
      cleanTo === cleanFrom ||
      (cleanTo.length >= 8 && cleanFrom.endsWith(cleanTo)) ||
      (cleanFrom.length >= 8 && cleanTo.endsWith(cleanFrom))
    );
  }, [testMobile, smsPhoneNumber]);

  const handleSendTestSms = async () => {
    if (!testMobile || !testMobile.trim()) {
      setTestSmsResult({ type: "error", msg: "Please enter a valid mobile number with country code (e.g. +91XXXXXXXXXX)" });
      return;
    }
    if (isRulesSameNumber) {
      setTestSmsResult({
        type: "error",
        msg: "This is your configured Twilio sending number. Please enter a different mobile number to receive the test SMS."
      });
      return;
    }
    setIsSendingTestSms(true);
    setTestSmsResult(null);
    try {
      const res = await sendTestSMS(testMobile);
      if (res.success) {
        setTestSmsResult({ type: "success", msg: `Test SMS dispatched successfully to ${res.mobile}!` });
      } else {
        setTestSmsResult({ type: "error", msg: res.note || "SMS delivery failed." });
      }
    } catch (err: any) {
      setTestSmsResult({ type: "error", msg: err.message || "Failed to send test SMS." });
    } finally {
      setIsSendingTestSms(false);
    }
  };

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
      {/* Settings Sub-Navigation Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-2 shadow-xs flex flex-wrap items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("sms")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "sms"
              ? "bg-violet-600 text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>SMS Settings (Twilio)</span>
          {isSmsConfigured ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "rules"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Alert Rules &amp; Sandbox</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "categories"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Categories &amp; Renewals</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "branding"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Chatbot Branding</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "all"
              ? "bg-gray-800 text-white shadow-xs"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>All Overview</span>
        </button>
      </div>

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

      {/* DEDICATED SMS SETTINGS PANEL */}
      {(activeTab === "sms" || activeTab === "all") && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  Twilio SMS Settings
                  {isSmsConfigured ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Twilio Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                      <AlertCircle className="w-3 h-3 text-amber-600" /> Not Configured
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configure Twilio Account SID, Auth Token, and Sender Mobile Number for automatic SMS alert digests.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadSmsSettings}
              disabled={isSmsLoading}
              className="self-start sm:self-center px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSmsLoading ? "animate-spin" : ""}`} />
              Reload Status
            </button>
          </div>

          {/* Verification Feedback Banner */}
          {smsSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-3 shadow-xs animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{smsSuccessMsg}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">Your credentials have been securely saved to the dedicated database table and verified with Twilio.</p>
              </div>
            </div>
          )}

          {smsErrorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-3 shadow-xs animate-fade-in">
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Credential Validation Check Failed</p>
                <p className="text-[11px] text-red-700 mt-0.5">{smsErrorMsg}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSaveSmsSettings} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Account SID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Twilio Account SID</span>
                  <span className="text-[10px] text-gray-400 font-normal">Twilio Console SID</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={smsAccountSid}
                  onChange={(e) => setSmsAccountSid(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
                />
              </div>

              {/* Twilio Phone Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>Twilio Sender Phone Number</span>
                  <span className="text-[10px] text-gray-400 font-normal">International format (e.g. +1234567890)</span>
                </label>
                <input
                  type="text"
                  placeholder="+1234567890"
                  value={smsPhoneNumber}
                  onChange={(e) => setSmsPhoneNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
                />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  This must be a number purchased through your Twilio account (found under Phone Numbers → Manage → Active Numbers in the Twilio Console) — not your own mobile number.
                </p>
              </div>
            </div>

            {/* Auth Token Input (Sensitive Masked) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-violet-600" />
                  Twilio Auth Token
                </span>
                {hasSmsAuthToken && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    Encrypted &amp; Masked
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showAuthToken ? "text" : "password"}
                  required={!hasSmsAuthToken}
                  placeholder={hasSmsAuthToken ? smsMaskedToken : "Enter sensitive Twilio Auth Token"}
                  value={smsAuthToken}
                  onChange={(e) => setSmsAuthToken(e.target.value)}
                  className="w-full pl-3.5 pr-24 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
                />
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowAuthToken(!showAuthToken)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-xs cursor-pointer"
                    title={showAuthToken ? "Hide token" : "Show token"}
                  >
                    {showAuthToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Auth tokens are saved securely in dedicated credentials storage and never shown back in plain text once saved ({smsMaskedToken || "••••••••1234"}). Leave unchanged to keep the existing token.
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-gray-100">
              <span className="text-[11px] text-gray-400">
                A quick validation call to Twilio is automatically performed upon clicking Save.
              </span>
              <button
                type="submit"
                disabled={isSmsSaving}
                className="w-full sm:w-auto px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSmsSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Validating &amp; Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save &amp; Validate Credentials
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Test SMS Action Panel */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-4 shadow-lg mt-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-violet-400" />
                <h4 className="text-xs font-bold text-slate-200">Send Test SMS Diagnostic</h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Live Gate Verification</span>
            </div>

            {testSmsResult && (
              <div className={`p-3 rounded-xl text-xs space-y-2 ${
                testSmsResult.type === "success" 
                  ? "bg-emerald-950/80 border border-emerald-800 text-emerald-200" 
                  : "bg-red-950/80 border border-red-800 text-red-200"
              }`}>
                <p>{testSmsResult.msg}</p>
                {testSmsResult.type === "error" && (
                  <div className="pt-2 border-t border-red-800/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-red-300">
                      Verify your configured Twilio Phone Number in SMS Settings.
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("sms")}
                      className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white font-bold text-[10px] rounded-md transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Settings className="w-3 h-3" /> Go to SMS Settings
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="+919876543210"
                  value={testMobile}
                  onChange={(e) => setTestMobile(e.target.value)}
                  className={`w-full sm:flex-1 px-3.5 py-2 bg-slate-800 border rounded-xl text-xs text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors ${
                    isRulesSameNumber ? "border-red-500 bg-red-950/20" : "border-slate-700"
                  }`}
                />
                <button
                  type="button"
                  onClick={handleSendTestSms}
                  disabled={isSendingTestSms || isRulesSameNumber || !testMobile.trim()}
                  className="w-full sm:w-auto px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isSendingTestSms ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send Test SMS
                </button>
              </div>
              {isRulesSameNumber ? (
                <p className="text-xs text-red-400 font-medium flex items-center gap-1 leading-snug">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                  This is your configured Twilio sending number. Please enter a different mobile number to receive the test SMS.
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Enter a mobile number different from your Twilio sending number (set in SMS Settings) to receive this test message.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OTHER SETTINGS SECTIONS */}
      {(activeTab === "rules" || activeTab === "all") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <h4 className="text-xs font-semibold text-gray-900">Email Routing &amp; Sandbox Routing</h4>
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
        </div>
      )}

      {(activeTab === "categories" || activeTab === "all") && (
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
      )}

      {(activeTab === "branding" || activeTab === "all") && (
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
      )}

      {/* Global Config Save Actions */}
      {activeTab !== "sms" && (
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
      )}
    </div>
  );
}
