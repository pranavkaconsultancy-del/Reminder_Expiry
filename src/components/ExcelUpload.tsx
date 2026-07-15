import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, FileSpreadsheet, Check, AlertTriangle, X } from "lucide-react";

interface ExcelUploadProps {
  onUploadSuccess: (importedCount: number) => void;
  categories: string[];
}

interface ParsedRow {
  rowId: number;
  itemName: string;
  category: string;
  responsibleName: string;
  responsibleEmail: string;
  customerName?: string;
  customerEmail?: string;
  expiryDate: string;
  renewalDate: string;
  notes: string;
  isValid: boolean;
  errorMessage: string;
}

export default function ExcelUpload({ onUploadSuccess, categories }: ExcelUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    // Generate a beautiful template with sample rows matching the exact columns requested
    const headers = ["Name", "Category", "Responsible Person", "Email", "Customer Name", "Customer Email", "Expiry Date", "Renewal Date", "Notes"];
    const samples = [
      ["Office Property Insurance", "Insurance", "Pranav K", "pranavk.aconsultancy@gmail.com", "ABC Corp", "customer.abc@example.com", "2026-12-31", "", "Annual policy with premium payment due Dec 1st."],
      ["Server Room AC Service AMC", "Equipment Servicing", "Pranav K", "pranavk.aconsultancy@gmail.com", "", "", "2026-08-15", "2026-08-10", "Quarterly checks. CoolTech Solutions contact: +1-555-0199"],
      ["Figma Enterprise License", "Software License", "Pranav K", "pranavk.aconsultancy@gmail.com", "Design Team Inc", "customer.design@example.com", "2026-10-01", "2026-09-25", "Auto-renewal is turned off. Review seat count before renewal."]
    ];

    const data = [headers, ...samples];
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    ws["!cols"] = [
      { wch: 30 }, // Name
      { wch: 18 }, // Category
      { wch: 22 }, // Responsible Person
      { wch: 25 }, // Email
      { wch: 22 }, // Customer Name
      { wch: 25 }, // Customer Email
      { wch: 15 }, // Expiry Date
      { wch: 15 }, // Renewal Date
      { wch: 45 }  // Notes
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reminders Template");
    XLSX.writeFile(wb, "Reminder_Manager_Template.xlsx");
  };

  // Helper to format Date values correctly
  const formatDateValue = (val: any): string => {
    if (!val) return "";
    if (val instanceof Date && !isNaN(val.getTime())) {
      return val.toISOString().split("T")[0];
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split("T")[0];
    }
    return str;
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.name.endsWith(".csv")) {
      setError("Please upload an Excel spreadsheet (.xlsx, .xls) or CSV file.");
      return;
    }

    setFileName(file.name);
    setError(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary", cellDates: true, dateNF: "yyyy-mm-dd" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet to JSON using row objects
        const rawJson = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          setError("The uploaded file is empty.");
          setIsProcessing(false);
          return;
        }

        const formattedRows: ParsedRow[] = rawJson.map((row: any, index) => {
          // Parse exact columns: Name, Category, Responsible Person, Email, Customer Name, Customer Email, Expiry Date, Renewal Date, Notes
          let name = (row["Name"] || row["Name "] || row["name"] || row["Item Name"] || "").toString().trim();
          let category = (row["Category"] || row["category"] || "").toString().trim();
          let person = (row["Responsible Person"] || row["Responsible person"] || row["person"] || "").toString().trim();
          let email = (row["Email"] || row["email"] || "").toString().trim();
          let customerName = (row["Customer Name"] || row["Customer name"] || row["customerName"] || "").toString().trim();
          let customerEmail = (row["Customer Email"] || row["Customer email"] || row["customerEmail"] || "").toString().trim();
          let expiry = formatDateValue(row["Expiry Date"] || row["Expiry date"] || row["expiry"] || row["expiryDate"]);
          let renewal = formatDateValue(row["Renewal Date"] || row["Renewal date"] || row["renewal"] || row["renewalDate"]);
          let notes = (row["Notes"] || row["notes"] || row["Notes "] || "").toString().trim();

          // Fallbacks for empty fields
          if (!category) {
            category = categories[0] || "Payment Due";
          }
          if (!person) {
            person = "Pranav K";
          }
          if (!email) {
            email = "pranavk.aconsultancy@gmail.com";
          }

          const isValid = !!name && !!expiry;
          const errorMessage = !isValid ? "Missing Name or Expiry Date." : "";

          return {
            rowId: index + 1,
            itemName: name,
            category,
            responsibleName: person,
            responsibleEmail: email,
            customerName: customerName || undefined,
            customerEmail: customerEmail || undefined,
            expiryDate: expiry,
            renewalDate: renewal,
            notes,
            isValid,
            errorMessage
          };
        });

        setParsedData(formattedRows);
      } catch (err: any) {
        console.error(err);
        setError("Error parsing file. Please ensure it is a valid Excel format.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChangeLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    const validRows = parsedData.filter((row) => row.isValid);
    if (validRows.length === 0) {
      setError("No valid obligations found to import.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const itemsToUpload = validRows.map((row) => {
      // Calculate active or expired status
      let status: "Active" | "Expired" = "Active";
      if (row.expiryDate && !isNaN(Date.parse(row.expiryDate))) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(row.expiryDate);
        expiry.setHours(0, 0, 0, 0);
        if (expiry < today) {
          status = "Expired";
        }
      }

      return {
        itemName: row.itemName,
        category: row.category,
        responsibleName: row.responsibleName,
        responsibleEmail: row.responsibleEmail,
        expiryDate: row.expiryDate,
        renewalDate: row.renewalDate,
        status,
        notes: row.notes,
        customerName: row.customerName || null,
        customerEmail: row.customerEmail || null
      };
    });

    try {
      const response = await fetch("/api/reminders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemsToUpload),
      });

      if (response.ok) {
        onUploadSuccess(validRows.length);
        setParsedData([]);
        setFileName("");
      } else {
        const errJson = await response.json();
        setError(errJson.error || "Failed to upload obligations to server.");
      }
    } catch (err: any) {
      setError(err.message || "Network error uploading data.");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFile = () => {
    setParsedData([]);
    setFileName("");
    setError(null);
  };

  const validCount = parsedData.filter((r) => r.isValid).length;
  const skippedCount = parsedData.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-6" id="excel-upload-screen">
      {/* Description Panel & Sample Download */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Excel Bulk Import
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Download our standard sample template to format your data, populate your business obligations, and upload them here.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap self-start md:self-auto shadow-2xs"
        >
          <Download className="w-4 h-4 text-blue-600" />
          Download Sample Template
        </button>
      </div>

      {/* Main Upload Area */}
      {parsedData.length === 0 ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragActive
              ? "border-blue-600 bg-blue-50/20 shadow-xs"
              : "border-gray-200 bg-white hover:border-blue-400 hover:bg-gray-50/10"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChangeLocal}
            className="hidden"
            accept=".xlsx, .xls, .csv"
          />
          <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-4">
            <Upload className="w-8 h-8" />
          </div>
          <p className="text-gray-900 font-semibold text-base mb-1">
            Drag and drop your spreadsheet here
          </p>
          <p className="text-gray-400 text-xs mb-3 text-center">
            Upload your Excel file — we'll automatically add all reminders for you.
          </p>
          <div className="text-[11px] text-gray-400 border-t border-gray-100 pt-4 w-full text-center">
            Supported formats: <strong className="text-gray-600">.xlsx, .xls, .csv</strong>
          </div>
        </div>
      ) : (
        /* Preview Panel */
        <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                Preview: {fileName}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Found <span className="font-bold text-green-600">{validCount} rows ready to import</span>
                {skippedCount > 0 && (
                  <span className="text-red-500 font-bold ml-1">
                    ({skippedCount} rows will be skipped — missing Name or Expiry Date)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={clearFile}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-md transition-colors cursor-pointer self-start sm:self-auto"
            >
              Clear File
            </button>
          </div>

          <div className="p-5">
            {/* Warning banner for skipped rows */}
            {skippedCount > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{skippedCount} rows skipped — missing Name or Expiry Date.</span> These rows are highlighted in red in the preview below and will not be imported.
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Preview Table */}
            <div className="overflow-x-auto max-h-96 border border-gray-100 rounded-xl mb-5">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Row</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Responsible Person</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Renewal Date</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {parsedData.map((row) => (
                    <tr
                      key={row.rowId}
                      className={`transition-colors ${
                        !row.isValid ? "bg-red-50/50 hover:bg-red-50 text-red-900" : "hover:bg-gray-50/50"
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-gray-400">{row.rowId}</td>
                      <td className="py-3 px-4 font-semibold">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                            Skip
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        {row.itemName || <span className="text-red-400 italic font-normal">[Missing Name]</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-semibold text-[11px] border border-gray-200/50">
                          {row.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{row.responsibleName}</div>
                        <div className="text-[10px] text-gray-400">{row.responsibleEmail}</div>
                      </td>
                      <td className="py-3 px-4">
                        {row.customerEmail ? (
                          <>
                            <div className="font-semibold text-blue-700">{row.customerName || "-"}</div>
                            <div className="text-[10px] text-blue-500">{row.customerEmail}</div>
                          </>
                        ) : (
                          <span className="text-gray-400 font-normal italic">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {row.expiryDate || <span className="text-red-400 italic font-normal">[Missing Expiry]</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500">{row.renewalDate || "-"}</td>
                      <td className="py-3 px-4 text-gray-400 truncate max-w-[200px]" title={row.notes}>
                        {row.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={clearFile}
                className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0 || isProcessing}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors border ${
                  validCount === 0 || isProcessing
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white border-blue-700 cursor-pointer"
                }`}
              >
                {isProcessing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
