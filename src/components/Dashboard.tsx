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
  Info,
  Printer
} from "lucide-react";
import { Reminder, GlobalConfig } from "../types";
import { DatabaseStatus } from "../lib/api";
import SyncAILogo from "./SyncAILogo";
import { jsPDF } from "jspdf";

interface DashboardProps {
  reminders: Reminder[];
  categories: string[];
  config: GlobalConfig;
  dbStatus?: DatabaseStatus | null;
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
  dbStatus,
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

  useEffect(() => {
    const handleApplyFilter = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail) return;
      const { search, category, status, person } = customEvent.detail;
      if (search !== undefined) setSearchTerm(search);
      if (category !== undefined) setSelectedCategory(category);
      if (status !== undefined) setSelectedStatus(status);
      if (person !== undefined) setSelectedPerson(person);
    };
    window.addEventListener("apply-dashboard-filter", handleApplyFilter);
    return () => {
      window.removeEventListener("apply-dashboard-filter", handleApplyFilter);
    };
  }, []);
  
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

  // "Export PDF Report" Modal State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
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

  // Programmatic enterprise PDF report download via jsPDF
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Total Pages placeholder string we'll replace later
      const TOTAL_PAGES_PLACEHOLDER = "___";

      const drawHeader = () => {
        // --- LOGO & HEADER ---
        const logoX = 15;
        const logoY = 13;
        
        // Connection lines (Teal/Blue)
        doc.setDrawColor(26, 110, 142); 
        doc.setLineWidth(0.4);
        
        // Define molecular nodes (relative to logoX, logoY)
        const nodes = [
          { x: 2, y: 5 },
          { x: 8, y: 2 },
          { x: 13, y: 3.5 },
          { x: 4.5, y: 10 },
          { x: 12.5, y: 12 },
          { x: 1, y: 14.5 },
          { x: 3, y: 17.5 },
          { x: 9.5, y: 19 },
        ];

        // Draw connection lines between nodes
        doc.line(logoX + nodes[0].x, logoY + nodes[0].y, logoX + nodes[1].x, logoY + nodes[1].y);
        doc.line(logoX + nodes[0].x, logoY + nodes[0].y, logoX + nodes[3].x, logoY + nodes[3].y);
        doc.line(logoX + nodes[1].x, logoY + nodes[1].y, logoX + nodes[3].x, logoY + nodes[3].y);
        doc.line(logoX + nodes[1].x, logoY + nodes[1].y, logoX + nodes[2].x, logoY + nodes[2].y);
        doc.line(logoX + nodes[2].x, logoY + nodes[2].y, logoX + nodes[4].x, logoY + nodes[4].y);
        doc.line(logoX + nodes[3].x, logoY + nodes[3].y, logoX + nodes[4].x, logoY + nodes[4].y);
        doc.line(logoX + nodes[3].x, logoY + nodes[3].y, logoX + nodes[5].x, logoY + nodes[5].y);
        doc.line(logoX + nodes[4].x, logoY + nodes[4].y, logoX + nodes[5].x, logoY + nodes[5].y);
        doc.line(logoX + nodes[4].x, logoY + nodes[4].y, logoX + nodes[7].x, logoY + nodes[7].y);
        doc.line(logoX + nodes[5].x, logoY + nodes[5].y, logoX + nodes[6].x, logoY + nodes[6].y);
        doc.line(logoX + nodes[5].x, logoY + nodes[5].y, logoX + nodes[7].x, logoY + nodes[7].y);
        doc.line(logoX + nodes[6].x, logoY + nodes[6].y, logoX + nodes[7].x, logoY + nodes[7].y);

        // Draw nodes
        const nodeColors = [
          { r: 17, g: 53, b: 106 }, 
          { r: 20, g: 77, b: 133 },
          { r: 11, g: 117, b: 128 }, 
          { r: 11, g: 117, b: 128 },
          { r: 12, g: 138, b: 150 },
          { r: 14, g: 166, b: 118 }, 
          { r: 16, g: 185, b: 129 },
          { r: 12, g: 138, b: 150 },
        ];

        nodes.forEach((node, idx) => {
          const color = nodeColors[idx];
          doc.setFillColor(color.r, color.g, color.b);
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.3);
          doc.circle(logoX + node.x, logoY + node.y, 1.1, "FD");
        });

        // Text part of Logo
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(17, 53, 106); 
        doc.text("Sync", 32, 19);

        doc.setTextColor(11, 117, 128); 
        doc.text("AI", 46, 19);

        // Radiating AI circular circuit dot
        doc.setFillColor(14, 166, 118); 
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.2);
        doc.circle(53, 14, 0.9, "FD");

        // Subtitle: "Consultancy Pvt. Ltd."
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(120, 120, 120);
        doc.text("CONSULTANCY PVT. LTD.", 32, 22.5);

        // Sub-headline
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text("COMPLIANCE & OBLIGATION REGISTRY", 15, 28);

        // Right Header Block
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.text("COMPLIANCE DEADLINE REPORT", 195, 17, { align: "right" });

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`Date Generated: ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}`, 195, 21, { align: "right" });
        
        const scopeText = searchTerm || selectedCategory || selectedStatus || selectedPerson ? "Filtered Subset" : "All System Obligations";
        doc.text(`Scope: ${scopeText}`, 195, 24.5, { align: "right" });
        
        doc.setFont("Helvetica", "bold");
        doc.text("Database: ", 175, 28, { align: "right" });
        doc.setTextColor(26, 110, 142); 
        doc.text("Active (Supabase)", 195, 28, { align: "right" });

        // Border below header
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.4);
        doc.line(15, 31, 195, 31);
      };

      const drawFooter = (pageNumber: number) => {
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.4);
        doc.line(15, 282, 195, 282);

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text("SyncAI Consultancy Pvt. Ltd. Compliance System", 15, 287);
        doc.text("CONFIDENTIAL - FOR INTERNAL USE ONLY", 105, 287, { align: "center" });
        doc.text(`Page ${pageNumber} of ${TOTAL_PAGES_PLACEHOLDER}`, 195, 287, { align: "right" });
      };

      // First page setup
      drawHeader();

      // 1. Company Information Section
      let currentY = 37;
      doc.setFillColor(240, 247, 247); 
      doc.setDrawColor(224, 239, 240); 
      doc.setLineWidth(0.3);
      doc.roundedRect(15, currentY, 180, 16, 2, 2, "FD");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(110, 130, 140);
      doc.text("COMPANY INFORMATION", 18, currentY + 5);
      doc.text("DEPARTMENT & AUTHORITY", 78, currentY + 5);
      doc.text("TOTAL STATUS VOLUME", 138, currentY + 5);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(26, 58, 110); 
      doc.text("SyncAI Consultancy Pvt. Ltd.", 18, currentY + 10.5);
      doc.text("Compliance & Legal Obligations Registry", 78, currentY + 10.5);
      doc.text(`${processedReminders.length} of ${reminders.length} Items Listed`, 138, currentY + 10.5);

      // 2. Metrics row
      currentY = 58;
      const overdueCount = processedReminders.filter(r => getDaysRemainingLocal(r.expiryDate) < 0 || r.status === "Expired").length;
      const soonCount = processedReminders.filter(r => {
        const d = getDaysRemainingLocal(r.expiryDate);
        return d >= 0 && d <= 30 && r.status !== "Expired";
      }).length;
      const healthyCount = processedReminders.filter(r => getDaysRemainingLocal(r.expiryDate) > 30 && r.status !== "Expired").length;

      // Overdue Card
      doc.setFillColor(254, 242, 242); 
      doc.setDrawColor(254, 226, 226); 
      doc.roundedRect(15, currentY, 56, 14, 1.5, 1.5, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(239, 68, 68); 
      doc.text("OVERDUE / EXPIRED", 18, currentY + 4.5);
      doc.setFontSize(11);
      doc.text(String(overdueCount), 18, currentY + 10);

      // Expiring Soon Card
      doc.setFillColor(255, 251, 235); 
      doc.setDrawColor(254, 243, 199); 
      doc.roundedRect(77, currentY, 56, 14, 1.5, 1.5, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(217, 119, 6); 
      doc.text("EXPIRING SOON", 80, currentY + 4.5);
      doc.setFontSize(11);
      doc.text(String(soonCount), 80, currentY + 10);

      // Healthy Card
      doc.setFillColor(240, 253, 244); 
      doc.setDrawColor(220, 252, 231); 
      doc.roundedRect(139, currentY, 56, 14, 1.5, 1.5, "FD");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(22, 163, 74); 
      doc.text("ACTIVE & HEALTHY", 142, currentY + 4.5);
      doc.setFontSize(11);
      doc.text(String(healthyCount), 142, currentY + 10);

      // 3. Table header
      currentY = 78;
      doc.setFillColor(243, 244, 246); 
      doc.setDrawColor(229, 231, 235); 
      doc.roundedRect(15, currentY, 180, 8, 1, 1, "FD");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(75, 85, 99); 
      doc.text("OBLIGATION NAME", 18, currentY + 5.5);
      doc.text("CATEGORY", 70, currentY + 5.5);
      doc.text("EXPIRY DATE", 110, currentY + 5.5);
      doc.text("RESPONSIBLE PERSON", 145, currentY + 5.5);
      doc.text("STATUS", 182, currentY + 5.5, { align: "center" });

      currentY = 86; 
      let currentPage = 1;

      // Draw items
      if (processedReminders.length === 0) {
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(150, 150, 150);
        doc.text("No obligations found matching the current report parameters.", 105, currentY + 12, { align: "center" });
        currentY += 20;
      } else {
        processedReminders.forEach((r) => {
          // Check for page break (limit to 255 to allow space for page numbers/footers)
          if (currentY > 255) {
            drawFooter(currentPage);
            doc.addPage();
            currentPage++;
            drawHeader();
            
            // Draw Table header on new page
            currentY = 37;
            doc.setFillColor(243, 244, 246); 
            doc.setDrawColor(229, 231, 235); 
            doc.roundedRect(15, currentY, 180, 8, 1, 1, "FD");

            doc.setFont("Helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(75, 85, 99); 
            doc.text("OBLIGATION NAME", 18, currentY + 5.5);
            doc.text("CATEGORY", 70, currentY + 5.5);
            doc.text("EXPIRY DATE", 110, currentY + 5.5);
            doc.text("RESPONSIBLE PERSON", 145, currentY + 5.5);
            doc.text("STATUS", 182, currentY + 5.5, { align: "center" });

            currentY = 45;
          }

          // Row separator line
          doc.setDrawColor(243, 244, 246);
          doc.setLineWidth(0.25);
          doc.line(15, currentY, 195, currentY);

          // Draw row values
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(17, 24, 39); 

          let itemNameText = r.itemName;
          if (itemNameText.length > 34) {
            itemNameText = itemNameText.substring(0, 31) + "...";
          }
          doc.text(itemNameText, 18, currentY + 5.5);

          doc.setFont("Helvetica", "normal");
          doc.setTextColor(75, 85, 99); 
          doc.text(r.category, 70, currentY + 5.5);

          const days = getDaysRemainingLocal(r.expiryDate);
          const isOverdue = days < 0 || r.status === "Expired";
          const isSoon = days >= 0 && days <= 30 && r.status !== "Expired";

          doc.setFont("Helvetica", "bold");
          doc.setTextColor(17, 24, 39);
          doc.text(r.expiryDate, 110, currentY + 5);
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(140, 140, 140);
          const remainingText = isOverdue ? "Expired" : `${days} days remaining`;
          doc.text(remainingText, 110, currentY + 8);

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(75, 85, 99);
          let respNameText = r.responsibleName;
          if (respNameText.length > 22) {
            respNameText = respNameText.substring(0, 19) + "...";
          }
          doc.text(respNameText, 145, currentY + 5);
          doc.setFontSize(6);
          doc.setTextColor(140, 140, 140);
          let respEmailText = r.responsibleEmail;
          if (respEmailText.length > 25) {
            respEmailText = respEmailText.substring(0, 22) + "...";
          }
          doc.text(respEmailText, 145, currentY + 8);

          // Status Badge
          let badgeBg = [240, 253, 244]; 
          let badgeBorder = [220, 252, 231]; 
          let badgeText = [22, 163, 74]; 
          let badgeLabel = "HEALTHY";

          if (isOverdue) {
            badgeBg = [254, 242, 242]; 
            badgeBorder = [254, 226, 226]; 
            badgeText = [185, 28, 28]; 
            badgeLabel = "OVERDUE";
          } else if (isSoon) {
            badgeBg = [255, 251, 235]; 
            badgeBorder = [254, 243, 199]; 
            badgeText = [180, 83, 9]; 
            badgeLabel = "DUE SOON";
          }

          doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
          doc.setDrawColor(badgeBorder[0], badgeBorder[1], badgeBorder[2]);
          doc.setLineWidth(0.25);
          doc.roundedRect(172, currentY + 2.5, 20, 4.5, 0.8, 0.8, "FD");

          doc.setFont("Helvetica", "bold");
          doc.setFontSize(5.5);
          doc.setTextColor(badgeText[0], badgeText[1], badgeText[2]);
          doc.text(badgeLabel, 182, currentY + 5.7, { align: "center" });

          currentY += 10.5; 
        });
      }

      // Check if signature section fits, if not, push to new page
      if (currentY > 230) {
        drawFooter(currentPage);
        doc.addPage();
        currentPage++;
        drawHeader();
        currentY = 37;
      }

      // Horizontal divider above signatures
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.4);
      doc.line(15, currentY + 5, 195, currentY + 5);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(140, 140, 140);
      doc.text("SyncAI Consultancy Pvt. Ltd. Compliance System", 15, currentY + 12);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6);
      doc.text("This document is an authentic computer-generated compliance and legal record of active obligations.", 15, currentY + 15.5);
      doc.text("Any authorized adjustments or renewals must be registered with legal clearance.", 15, currentY + 18.5);

      // Signature Line
      doc.setDrawColor(160, 160, 160);
      doc.setLineWidth(0.3);
      doc.line(140, currentY + 18, 185, currentY + 18);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(120, 120, 120);
      doc.text("AUTHORIZED SIGNATORY", 162.5, currentY + 21.5, { align: "center" });

      // Draw footer on last page
      drawFooter(currentPage);

      // Overwrite placeholders
      const totalPagesStr = String(currentPage);
      for (let i = 1; i <= currentPage; i++) {
        doc.setPage(i);
        
        // Clear area where the page numbers are drawn
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(255, 255, 255);
        doc.rect(172, 283.5, 24, 5.5, "F");
        
        // Draw real page numbers
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(`Page ${i} of ${totalPagesStr}`, 195, 287, { align: "right" });
      }

      // Filename construction
      const formattedDate = new Date().toISOString().split('T')[0];
      const filename = `SyncAI_Compliance_Report_${formattedDate}.pdf`;

      // Trigger automatic blob download
      const pdfBlob = doc.output("blob");
      const blobURL = URL.createObjectURL(pdfBlob);
      
      const downloadLink = document.createElement("a");
      downloadLink.href = blobURL;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobURL);
      
      setIsGeneratingPdf(false);
    } catch (err: any) {
      console.error("PDF download failure:", err);
      setPdfError(err?.message || "An unexpected error occurred during PDF generation.");
      setIsGeneratingPdf(false);
    }
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
      
      {/* Supabase Error Alert Banner */}
      {dbStatus?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-xs animate-fade-in flex gap-4">
          <div className="p-2.5 bg-red-100 text-red-600 rounded-lg shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h3 className="text-sm font-black text-red-950 uppercase tracking-wide">
              Supabase Connection Failure
            </h3>
            <p className="text-xs text-red-900 leading-relaxed">
              We encountered an issue attempting to fetch compliance and obligation records from your Supabase database. The dashboard has safely fallen back to local web-storage mode, but the live cloud data is unreachable.
            </p>
            <div className="bg-white/80 border border-red-100/50 rounded-lg p-3 mt-2 text-xs font-mono text-red-800 break-all select-all">
              <strong>Error Code & Reason:</strong> {dbStatus.error}
            </div>
            <div className="text-xs text-red-700/85 mt-2 bg-red-100/30 p-3 rounded-lg border border-red-200/40">
              <span className="font-bold block text-red-800 text-[11px] uppercase tracking-wider mb-1">🛠️ How to Resolve in Vercel:</span>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Go to your **Vercel Project Settings &rarr; Environment Variables** tab.</li>
                <li>Ensure you have added <code className="font-mono bg-white px-1 py-0.5 rounded border border-red-200/50">SUPABASE_URL</code> and <code className="font-mono bg-white px-1 py-0.5 rounded border border-red-200/50">SUPABASE_ANON_KEY</code>.</li>
                <li>Ensure you also configure <code className="font-mono bg-white px-1 py-0.5 rounded border border-red-200/50">SUPABASE_DATABASE_URL</code> for backend pooling.</li>
                <li>**IMPORTANT:** Since you are deploying a custom full-stack backend server in Node, do <strong>NOT</strong> prefix these with <code className="font-mono bg-white px-1">VITE_</code> because they are accessed in server-side routes (<code className="font-mono bg-white px-1">process.env.*</code>).</li>
                <li>After adding variables, trigger a <strong>redeploy</strong> ("Redeploy" button in Vercel) for the changes to take effect!</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      
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

          {/* Action Buttons: Add New and Export PDF Report */}
          <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-auto">
            <button
              onClick={() => setIsReportOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg shadow-xs border border-gray-200 cursor-pointer transition-all"
              title="Generate a printable compliance PDF report of your obligations"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              Generate PDF Report
            </button>
            
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
                            <Mail className="w-3 h-3 shrink-0 text-blue-500" />
                            <span className="truncate max-w-[150px]">{r.responsibleEmail}</span>
                          </div>
                          {r.customer_email && (
                            <div className="mt-1 flex items-center gap-1 bg-indigo-50 border border-indigo-100/50 rounded-md px-1.5 py-0.5 w-fit" title={`Customer Email configured: ${r.customer_name || 'Customer'} (${r.customer_email})`}>
                              <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                              <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider">Also Notifies Customer</span>
                            </div>
                          )}
                        </td>

                        {/* Criticality Badge */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isOverdue ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                                  <AlertTriangle className="w-3 h-3" /> Expired
                                </span>
                                {(r.acknowledged === true || r.acknowledged === 'true') && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full" title={`Acknowledged on ${r.acknowledged_at || 'unknown date'}`}>
                                    <CheckCircle className="w-3 h-3 text-blue-500" /> Acknowledged
                                  </span>
                                )}
                              </>
                            ) : isSoon ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" /> Due Soon
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                                <CheckCircle className="w-3 h-3" /> Active
                              </span>
                            )}
                          </div>
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

                                {r.customer_email && (
                                  <div>
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Also Notifies Customer</span>
                                    <div className="bg-indigo-50 p-3.5 rounded-lg border border-indigo-100/50 flex flex-col gap-1.5 text-xs">
                                      <div className="flex items-center gap-1.5 text-indigo-950">
                                        <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-12">Name:</span>
                                        <span className="font-bold text-indigo-900">{r.customer_name || <span className="text-gray-400 italic font-normal">Not Provided</span>}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-indigo-950">
                                        <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-12">Email:</span>
                                        <span className="font-mono font-bold text-indigo-900">{r.customer_email}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
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

      {/* 8. SyncAI Compliance & Obligations PDF Report Modal */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900 text-sm">Generate SyncAI Compliance Report</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg cursor-pointer transition-colors shadow-xs border border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isGeneratingPdf ? "Generating PDF..." : "Download PDF"}
                </button>
                <button
                  onClick={() => {
                    setIsReportOpen(false);
                    setPdfError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1.5 rounded-md transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Error Message */}
            {pdfError && (
              <div className="mx-8 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium flex items-center gap-2 animate-fade-in no-print">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}

            {/* Printable Report Document Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-white" id="printable-report">
              {/* Report Header Block */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-gray-200 pb-6 mb-6 gap-4">
                <div>
                  <SyncAILogo height={45} />
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1.5 uppercase font-sans">
                    SyncAI Compliance &amp; Obligation Registry
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs text-gray-500 space-y-1">
                  <p className="font-bold text-gray-800 text-sm">COMPLIANCE DEADLINE REPORT</p>
                  <p>Date Generated: {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                  <p>Scope: {searchTerm || selectedCategory || selectedStatus || selectedPerson ? "Filtered Subset" : "All System Obligations"}</p>
                  <p>Database: <span className="font-bold uppercase text-blue-600">Active</span></p>
                </div>
              </div>

              {/* Company Information Block */}
              <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company Information</span>
                  <span className="text-xs font-bold text-gray-800">SyncAI Consultancy Pvt. Ltd.</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Department &amp; Authority</span>
                  <span className="text-xs font-bold text-gray-800">Compliance &amp; Legal Obligations Registry</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Status Volume</span>
                  <span className="text-xs font-bold text-gray-800">
                    {processedReminders.length} of {reminders.length} Items Listed
                  </span>
                </div>
              </div>

              {/* Status Mini Metrics for the Report */}
              <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-in">
                <div className="p-3 bg-red-50/60 rounded-lg border border-red-100 text-center">
                  <span className="block text-[9px] font-bold text-red-500 uppercase tracking-wider">Overdue / Expired</span>
                  <span className="text-lg font-black text-red-700">
                    {processedReminders.filter(r => getDaysRemainingLocal(r.expiryDate) < 0 || r.status === "Expired").length}
                  </span>
                </div>
                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100 text-center">
                  <span className="block text-[9px] font-bold text-amber-600 uppercase tracking-wider">Expiring Soon</span>
                  <span className="text-lg font-black text-amber-700">
                    {processedReminders.filter(r => {
                      const d = getDaysRemainingLocal(r.expiryDate);
                      return d >= 0 && d <= 30 && r.status !== "Expired";
                    }).length}
                  </span>
                </div>
                <div className="p-3 bg-green-50/60 rounded-lg border border-green-100 text-center">
                  <span className="block text-[9px] font-bold text-green-600 uppercase tracking-wider">Active &amp; Healthy</span>
                  <span className="text-lg font-black text-green-700">
                    {processedReminders.filter(r => getDaysRemainingLocal(r.expiryDate) > 30 && r.status !== "Expired").length}
                  </span>
                </div>
              </div>

              {/* Report Table */}
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 border-b border-gray-200 font-bold text-gray-700 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Obligation Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Expiry Date</th>
                      <th className="py-2.5 px-3">Responsible Person</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {processedReminders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400 font-medium italic bg-gray-50/30">
                          No obligations found matching the current report parameters.
                        </td>
                      </tr>
                    ) : (
                      processedReminders.map((r) => {
                        const days = getDaysRemainingLocal(r.expiryDate);
                        const isOverdue = days < 0 || r.status === "Expired";
                        const isSoon = days >= 0 && days <= 30 && r.status !== "Expired";
                        return (
                          <tr key={r.id} className="hover:bg-gray-50/30">
                            <td className="py-2.5 px-3 font-bold text-gray-900">{r.itemName}</td>
                            <td className="py-2.5 px-3 text-gray-600">{r.category}</td>
                            <td className="py-2.5 px-3 font-mono text-gray-900">
                              {r.expiryDate} 
                              <span className="text-[10px] text-gray-400 block mt-0.5">
                                {isOverdue ? "Expired" : `${days} days remaining`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              <div>{r.responsibleName}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{r.responsibleEmail}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider ${
                                isOverdue 
                                  ? "bg-red-50 text-red-700 border border-red-100" 
                                  : isSoon 
                                    ? "bg-amber-50 text-amber-700 border border-amber-100" 
                                    : "bg-green-50 text-green-700 border border-green-100"
                              }`}>
                                {isOverdue ? "Overdue" : isSoon ? "Due Soon" : "Healthy"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures & Footer info */}
              <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between items-end gap-4">
                <div className="text-[10px] text-gray-400 font-semibold space-y-1 max-w-sm">
                  <p>SyncAI Consultancy Pvt. Ltd. Compliance System</p>
                  <p>This document is a certified computer-generated record of the company's active legal, operational, and commercial obligations.</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="w-36 border-b border-gray-400 mx-auto pb-1 mt-6"></div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mt-1 text-center">Authorized Signatory</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
