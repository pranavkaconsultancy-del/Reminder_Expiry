import React, { useState, useRef } from "react";
import {
  X,
  FileText,
  UploadCloud,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
  Mail,
  Tag,
  FileCheck
} from "lucide-react";
import { Reminder } from "../types";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminderData: Omit<Reminder, "id">) => Promise<void>;
  categories: string[];
  onAddCategory: (category: string) => void;
}

export default function DocumentUploadModal({
  isOpen,
  onClose,
  onSave,
  categories,
  onAddCategory
}: DocumentUploadModalProps) {
  const [step, setStep] = useState<"upload" | "analyzing" | "review">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extracted and editable state
  const [itemName, setItemName] = useState("");
  const [createdDate, setCreatedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [category, setCategory] = useState("Insurance");
  const [responsibleName, setResponsibleName] = useState("Pranav K");
  const [responsibleEmail, setResponsibleEmail] = useState("pranavk.aconsultancy@gmail.com");
  const [responsibleMobile, setResponsibleMobile] = useState("+919876543210");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetModal = () => {
    setStep("upload");
    setFile(null);
    setError(null);
    setItemName("");
    setCreatedDate("");
    setExpiryDate("");
    setCategory("Insurance");
    setResponsibleName("Pranav K");
    setResponsibleEmail("pranavk.aconsultancy@gmail.com");
    setResponsibleMobile("+919876543210");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerMobile("");
    setNotes("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;

    if (!selectedFile.type.includes("pdf") && !selectedFile.type.includes("image/")) {
      setError("Please select a PDF document or an image file (PNG/JPEG).");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setStep("analyzing");

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
      reader.readAsDataURL(selectedFile);
      const base64Data = await base64Promise;

      const response = await fetch("/api/ai/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64Data,
          mimeType: selectedFile.type || "application/pdf"
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to parse document");
      }

      const result = await response.json();

      // Populate form state from AI response
      setItemName(result.itemName || selectedFile.name.replace(/\.[^/.]+$/, ""));
      setCreatedDate(result.createdDate || "");
      setExpiryDate(result.expiryDate || "");

      if (result.category && categories.includes(result.category)) {
        setCategory(result.category);
      } else if (result.category) {
        onAddCategory(result.category);
        setCategory(result.category);
      } else {
        setCategory("Insurance");
      }

      if (result.responsibleName) setResponsibleName(result.responsibleName);
      if (result.responsibleEmail) setResponsibleEmail(result.responsibleEmail);
      if (result.responsibleMobile) setResponsibleMobile(result.responsibleMobile);
      if (result.customerName) setCustomerName(result.customerName);
      if (result.customerEmail) setCustomerEmail(result.customerEmail);
      if (result.customerMobile) setCustomerMobile(result.customerMobile);

      let initialNotes = result.notes || "";
      if (result.createdDate) {
        initialNotes = `Policy Start / Created Date: ${result.createdDate}` + (initialNotes ? `\n\n${initialNotes}` : "");
      }
      setNotes(initialNotes);

      setStep("review");
    } catch (err: any) {
      setError(err.message || "Could not read document. Please try again or fill in details manually.");
      setStep("upload");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!itemName.trim()) {
      setError("Please specify the Obligation / Policy Name.");
      return;
    }

    if (!expiryDate) {
      setError("Please specify an Expiry Date for the reminder.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate status based on expiry
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(expiryDate);
      expiry.setHours(0, 0, 0, 0);
      const computedStatus = expiry < today ? "Expired" : "Active";

      let finalNotes = notes.trim();
      if (createdDate && !finalNotes.includes(createdDate)) {
        finalNotes = `Policy Issue/Created Date: ${createdDate}` + (finalNotes ? `\n${finalNotes}` : "");
      }

      await onSave({
        itemName: itemName.trim(),
        category: category || "Insurance",
        responsibleName: responsibleName.trim() || "Pranav K",
        responsibleEmail: responsibleEmail.trim() || "pranavk.aconsultancy@gmail.com",
        responsibleMobile: responsibleMobile.trim() || undefined,
        expiryDate: expiryDate,
        renewalDate: "",
        status: computedStatus,
        notes: finalNotes,
        customer_name: customerName.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        customer_mobile: customerMobile.trim() || undefined
      });

      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to save reminder from document.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl my-8 overflow-hidden transition-all">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                Create Reminder from Document
              </h2>
              <p className="text-xs text-slate-400">
                Upload policy PDF/Image to auto-extract details and review before saving
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                />
                <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Click to upload or drag & drop document
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Upload an Insurance Policy, AMC Contract, License, or Visa PDF/Image to auto-extract Name, Issue Date & Expiry Date.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Supports PDF, PNG, JPG
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ANALYZING */}
          {step === "analyzing" && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse">
                  <Sparkles className="w-8 h-8" />
                </div>
                <Loader2 className="w-20 h-20 text-indigo-600 animate-spin absolute -top-2 -left-2" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Scanning Document with AI...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                Extracting policy title, issue/start date, expiry date, category, and remarks from <span className="font-semibold text-slate-700 dark:text-slate-200">{file?.name}</span>
              </p>
            </div>
          )}

          {/* STEP 3: REVIEW BEFORE SAVING */}
          {step === "review" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Banner Notice */}
              <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                    Extracted from document — please review and correct if needed
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold bg-indigo-200/80 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded">
                  AI Review
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Obligation / Policy Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Obligation / Policy Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g., AC Service Insurance / Allianz Fire Policy"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Created / Issue Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Created / Issue Date</span>
                    {createdDate ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Extracted
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Optional</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={createdDate}
                      onChange={(e) => setCreatedDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Expiry / Due Date <span className="text-rose-500">*</span></span>
                    {expiryDate ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Extracted
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Please select date
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                        !expiryDate
                          ? "border-amber-400 dark:border-amber-500/80 bg-amber-50/50 dark:bg-amber-950/20 focus:ring-amber-500"
                          : "border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                      }`}
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                  {!expiryDate && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                      Expiry date could not be confidently read. Please specify manually.
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Responsible Person Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Responsible Person
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      placeholder="Pranav K"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Responsible Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Responsible Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={responsibleEmail}
                      onChange={(e) => setResponsibleEmail(e.target.value)}
                      placeholder="pranavk.aconsultancy@gmail.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Responsible Mobile */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Responsible Mobile (SMS Digest)
                  </label>
                  <input
                    type="tel"
                    value={responsibleMobile}
                    onChange={(e) => setResponsibleMobile(e.target.value)}
                    placeholder="+91XXXXXXXXXX"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Customer / Client Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer / Insured Client
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g., Neemrana Kulkarni / ACME Corp"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Customer Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="e.g., customer@example.com"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Customer Mobile */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Mobile
                  </label>
                  <input
                    type="tel"
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value)}
                    placeholder="+91XXXXXXXXXX"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Notes & Summary */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notes & Coverage Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Policy notes, terms, coverage summary..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStep("upload")}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Upload Different File
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-xl transition shadow-md shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Reminder...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" /> Create Reminder
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
