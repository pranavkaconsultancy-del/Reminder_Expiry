import React, { useState, useEffect } from "react";
import { X, Calendar, Plus, Save, RotateCcw, AlertCircle, UploadCloud, Sparkles, Loader2 } from "lucide-react";
import { Reminder, ReminderRuleInterval, RULE_LABELS } from "../types";

interface ReminderFormProps {
  reminder: Reminder | null; // Null means Add New, non-null means Edit
  categories: string[];
  onSave: (reminderData: Omit<Reminder, "id">) => Promise<void>;
  onCancel: () => void;
  onAddCategory: (category: string) => void;
  reminders?: Reminder[]; // optional list for smart suggestions
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
  onAddCategory,
  reminders
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
  
  // AI features local state
  const [isUploading, setIsUploading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    itemName?: boolean;
    category?: boolean;
    expiryDate?: boolean;
  }>({});
  const [smartCategorySuggestion, setSmartCategorySuggestion] = useState<string | null>(null);
  const [timingSuggestion, setTimingSuggestion] = useState<{
    text: string;
    rules: ReminderRuleInterval[];
  } | null>(null);

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

  // Voice note state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceReviewText, setVoiceReviewText] = useState<string | null>(null);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);

  // File analysis handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setAiSuggestions({});

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = (err) => reject(err);
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await fetch("/api/ai/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64Data,
          mimeType: file.type || "application/pdf"
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to analyze document");
      }

      const result = await response.json();
      const suggestions: typeof aiSuggestions = {};

      if (result.itemName) {
        setItemName(result.itemName);
        suggestions.itemName = true;
      }
      if (result.category) {
        if (categories.includes(result.category)) {
          setCategory(result.category);
          suggestions.category = true;
        } else {
          onAddCategory(result.category);
          setCategory(result.category);
          suggestions.category = true;
        }
      }
      if (result.expiryDate) {
        // Run expiry change calculations
        const dateVal = result.expiryDate;
        setExpiryDate(dateVal);
        if (dateVal) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const expiry = new Date(dateVal);
          expiry.setHours(0, 0, 0, 0);
          if (expiry < today) {
            setStatus("Expired");
          } else {
            setStatus("Active");
          }
        }
        suggestions.expiryDate = true;
      }

      setAiSuggestions(suggestions);
    } catch (err: any) {
      setError(err.message || "An error occurred during document parsing.");
    } finally {
      setIsUploading(false);
    }
  };

  // Typing-based category suggestor
  useEffect(() => {
    if (!itemName.trim() || reminder) {
      setSmartCategorySuggestion(null);
      return;
    }

    const words = itemName.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    if (words.length === 0) {
      setSmartCategorySuggestion(null);
      return;
    }

    // Try finding in database records
    if (reminders && reminders.length > 0) {
      const matchCounts: Record<string, number> = {};
      for (const r of reminders) {
        const rNameLower = (r.itemName || "").toLowerCase();
        let matches = 0;
        for (const word of words) {
          if (rNameLower.includes(word)) {
            matches++;
          }
        }
        if (matches > 0 && r.category) {
          matchCounts[r.category] = (matchCounts[r.category] || 0) + matches;
        }
      }

      const sortedMatches = Object.entries(matchCounts).sort((a, b) => b[1] - a[1]);
      if (sortedMatches.length > 0) {
        const suggested = sortedMatches[0][0];
        if (suggested !== category) {
          setSmartCategorySuggestion(suggested);
          return;
        }
      }
    }

    // Fallback dictionary
    const fallbackRules = [
      { keywords: ["insurance", "allianz", "policy", "liability", "axa", "fwd"], category: "Insurance" },
      { keywords: ["visa", "passport", "permit", "immigrate", "workpermit"], category: "Employee Visa" },
      { keywords: ["license", "software", "saas", "adobe", "zoom", "microsoft", "office", "aws", "gcp", "azure", "figma", "github", "copilot"], category: "Software License" },
      { keywords: ["amc", "annual maintenance", "contractor", "yearly servicing"], category: "AMC" },
      { keywords: ["certificate", "compliance", "audit", "permit", "iso", "regulatory"], category: "Compliance Certificate" },
      { keywords: ["vehicle", "car", "truck", "motor", "auto", "vehicle insurance", "fleet"], category: "Vehicle Insurance" },
      { keywords: ["equipment", "printer", "ac", "air condition", "aircon", "servicing", "elevator", "generator", "repair"], category: "Equipment Servicing" },
      { keywords: ["pay", "payment", "due", "invoice", "bill", "rent", "tax", "repayment", "loan", "emi", "interest", "vendor"], category: "Payment Due" },
      { keywords: ["subscription", "hosting", "domain", "spotify", "netflix", "premium", "cloud", "monthly"], category: "Subscription" },
      { keywords: ["asset", "laptop", "server", "office lease", "furniture", "macbook"], category: "Company Asset" }
    ];

    for (const rule of fallbackRules) {
      if (rule.keywords.some(kw => words.some(w => w.includes(kw) || kw.includes(w)))) {
        const matchedCat = categories.find(c => c.toLowerCase() === rule.category.toLowerCase()) || rule.category;
        if (matchedCat !== category) {
          setSmartCategorySuggestion(matchedCat);
          return;
        }
      }
    }

    setSmartCategorySuggestion(null);
  }, [itemName, category, reminders, categories, reminder]);

  // Lead time timing suggestions based on category
  useEffect(() => {
    if (!category) {
      setTimingSuggestion(null);
      return;
    }

    const catLower = category.toLowerCase();
    if (catLower.includes("insurance") || catLower.includes("visa") || catLower.includes("certificate")) {
      setTimingSuggestion({
        text: "🔔 Suggested timing for Insurance/Visa: remind 30 days before",
        rules: ["one_month_before", "on_expiry"]
      });
    } else if (catLower.includes("pay") || catLower.includes("subscription") || catLower.includes("due") || catLower.includes("bill")) {
      setTimingSuggestion({
        text: "🔔 Suggested timing for Payments: remind 7 days before",
        rules: ["one_week_before", "on_expiry"]
      });
    } else if (catLower.includes("amc") || catLower.includes("license") || catLower.includes("servicing") || catLower.includes("equipment")) {
      setTimingSuggestion({
        text: "🔔 Suggested timing for AMC/License: remind 30 days before",
        rules: ["one_month_before", "on_expiry"]
      });
    } else {
      setTimingSuggestion(null);
    }
  }, [category]);

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
      setCustomerName(reminder.customer_name || "");
      setCustomerEmail(reminder.customer_email || "");
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

  // Voice recording functions
  const startRecording = async () => {
    try {
      setMicrophoneError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioUrl(null);
      setAudioBlob(null);
      setVoiceReviewText(null);
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      setMicrophoneError("Microphone access failed. Please ensure permissions are enabled.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleDiscardVoice = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setVoiceReviewText(null);
    setMediaRecorder(null);
  };

  const handleConfirmAndTranscribe = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    setMicrophoneError(null);
    try {
      // Read blob as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = (err) => reject(err);
      });
      reader.readAsDataURL(audioBlob);
      const fileBase64 = await base64Promise;

      const response = await fetch("/api/ai/transcribe-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64,
          mimeType: "audio/webm"
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Transcription failed");
      }

      const data = await response.json();
      if (data.text && data.text.trim()) {
        setVoiceReviewText(data.text.trim());
      } else {
        const today = new Date().toLocaleDateString("en-US", { day: 'numeric', month: 'short', year: 'numeric' });
        setVoiceReviewText(`[Voice note recorded on ${today} - transcription was silent or empty]`);
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      const today = new Date().toLocaleDateString("en-US", { day: 'numeric', month: 'short', year: 'numeric' });
      setVoiceReviewText(`[Voice note recorded on ${today} - transcription unavailable: ${err.message || "Error"}]`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAcceptTranscription = () => {
    if (voiceReviewText) {
      const divider = notes ? "\n" : "";
      setNotes(notes + divider + voiceReviewText);
      setAudioUrl(null);
      setAudioBlob(null);
      setVoiceReviewText(null);
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
      customer_name: customerName.trim() || undefined,
      customer_email: customerEmail.trim() || undefined
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
        {/* AI Document Scanner box */}
        {!reminder && (
          <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                AI Document Scanner (Autofill)
              </div>
              {isUploading && (
                <span className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Upload a PDF or Photo of the agreement, policy, license, or visa, and Gemini will automatically detect and populate the fields for you to review.
            </p>
            <div className="relative mt-2">
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-indigo-50/50 border border-indigo-200 hover:border-indigo-300 text-indigo-700 hover:text-indigo-800 text-xs font-semibold rounded-lg cursor-pointer transition-all shadow-2xs">
                <UploadCloud className="w-4 h-4 text-indigo-500" />
                {isUploading ? "Reading Document..." : "Choose PDF or Image"}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Item name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center justify-between">
            <span>Obligation / Item Name *</span>
            {aiSuggestions.itemName && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
                <Sparkles className="w-2.5 h-2.5" /> AI-suggested — please verify
              </span>
            )}
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center justify-between">
              <span>Category *</span>
              {aiSuggestions.category && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
                  <Sparkles className="w-2.5 h-2.5" /> AI-suggested — please verify
                </span>
              )}
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
            {smartCategorySuggestion && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-indigo-700 bg-indigo-50/50 p-1.5 rounded-lg border border-indigo-100/50">
                <span>💡 Best match:</span>
                <button
                  type="button"
                  onClick={() => {
                    setCategory(smartCategorySuggestion);
                    setSmartCategorySuggestion(null);
                  }}
                  className="underline hover:text-indigo-900 font-bold cursor-pointer"
                >
                  Set to {smartCategorySuggestion}
                </button>
              </div>
            )}
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center justify-between">
              <span>Expiry / Due Date *</span>
              {aiSuggestions.expiryDate && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
                  <Sparkles className="w-2.5 h-2.5" /> AI-suggested — please verify
                </span>
              )}
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

          {timingSuggestion && (
            <div className="p-2.5 bg-blue-50/50 border border-blue-100/50 rounded-lg text-[11px] text-blue-800 flex items-center justify-between gap-2">
              <span className="font-medium">{timingSuggestion.text}</span>
              <button
                type="button"
                onClick={() => {
                  setUseGlobalRules(false);
                  setRulesOverride(timingSuggestion.rules);
                }}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-md transition-colors uppercase tracking-wide cursor-pointer shrink-0"
              >
                Apply Suggestion
              </button>
            </div>
          )}

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
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Notes / Vendor Details
            </label>
            
            {/* Voice Note Recording Button */}
            <div className="flex items-center gap-2">
              {!isRecording && !audioUrl && !voiceReviewText && !isTranscribing && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-100 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Add Voice Note
                </button>
              )}
            </div>
          </div>

          {microphoneError && (
            <p className="text-[11px] text-red-600 font-medium mb-2">{microphoneError}</p>
          )}

          {/* Active Recording State Overlay */}
          {isRecording && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center justify-between gap-3 mb-2 animate-pulse">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                Recording voice note... Speak clearly.
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
              >
                Stop Recording
              </button>
            </div>
          )}

          {/* Review Audio & Transcribe Button */}
          {audioUrl && !isTranscribing && !voiceReviewText && (
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-indigo-900">Voice note recorded</span>
                <audio src={audioUrl} controls className="h-8 max-w-full" />
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleDiscardVoice}
                  className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-md cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndTranscribe}
                  className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Transcribe Voice Note
                </button>
              </div>
            </div>
          )}

          {/* Transcribing Loader */}
          {isTranscribing && (
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-2.5 mb-2 text-xs text-indigo-700 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Transcribing audio with Gemini model, please wait...
            </div>
          )}

          {/* Review Transcription Text */}
          {voiceReviewText && (
            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2 mb-2">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[10px] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                Transcribed from voice note — please review
              </div>
              <textarea
                value={voiceReviewText}
                onChange={(e) => setVoiceReviewText(e.target.value)}
                className="w-full p-2 bg-white border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 text-gray-800"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleDiscardVoice}
                  className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-md cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleAcceptTranscription}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-md cursor-pointer"
                >
                  Append to Notes
                </button>
              </div>
            </div>
          )}

          <textarea
            placeholder="e.g. Quote #QT-820, Allianz Policy details, Service Engineer contact number, website login portal link"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400 text-gray-800"
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
