import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  Sparkles, 
  Loader2, 
  Trash2, 
  CornerDownLeft, 
  HelpCircle,
  Clock,
  AlertTriangle
} from "lucide-react";
import { Reminder } from "../types";
import VoiceCommandButton from "./VoiceCommandButton";

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

interface ChatbotProps {
  reminders: Reminder[];
  chatbotLogo?: string;
}

function getDaysRemainingLocal(expiryStr: string): number {
  if (!expiryStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryStr);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function formatDateFriendlyLocal(dateStr: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function analyzeQuestionLocally(question: string, reminders: Reminder[]): string | null {
  const q = question.toLowerCase().trim();

  if (reminders.length === 0) {
    return "There are currently no obligations or reminders tracked in the database. Please add a new reminder or import an Excel file so I can assist you!";
  }

  // Helper arrays
  const uniquePersons = Array.from(new Set(reminders.map(r => r.responsibleName.trim()).filter(Boolean)));
  const uniqueCategories = Array.from(new Set(reminders.map(r => r.category.trim()).filter(Boolean)));

  // Match 1: Overdue items
  if (q.includes("overdue") || q.includes("expired") || q.includes("past due")) {
    const overdue = reminders.filter(r => {
      const days = getDaysRemainingLocal(r.expiryDate);
      return days < 0 || r.status === "Expired";
    });

    if (overdue.length === 0) {
      return "🎉 **Great news!** There are currently **no overdue items** in your obligations database.";
    }

    const count = overdue.length;
    const limit = 6;
    const displayed = overdue.slice(0, limit);
    
    let answer = `### Overdue Obligations\nThere are **${count}** overdue item(s) in your database:\n\n`;
    displayed.forEach(r => {
      const days = Math.abs(getDaysRemainingLocal(r.expiryDate));
      answer += `- **${r.itemName}** (${r.category}) — Expired on **${formatDateFriendlyLocal(r.expiryDate)}** (${days} days overdue). Responsible: **${r.responsibleName}**\n`;
    });

    if (count > limit) {
      answer += `\n*and **${count - limit}** more — check the dashboard table for the full list.*`;
    }
    return answer;
  }

  // Match 2: Due this week
  if (q.includes("this week") || q.includes("due soon") || q.includes("7 days") || q.includes("week")) {
    const dueSoon = reminders.filter(r => {
      const days = getDaysRemainingLocal(r.expiryDate);
      return days >= 0 && days <= 7 && r.status !== "Renewed";
    });

    if (dueSoon.length === 0) {
      return "📅 There are **no items** expiring this week (next 7 days). All systems look clear!";
    }

    const count = dueSoon.length;
    const limit = 6;
    const displayed = dueSoon.slice(0, limit);

    let answer = `### Due This Week\nThere are **${count}** item(s) expiring in the next 7 days:\n\n`;
    displayed.forEach(r => {
      const days = getDaysRemainingLocal(r.expiryDate);
      answer += `- **${r.itemName}** (${r.category}) — Due on **${formatDateFriendlyLocal(r.expiryDate)}** (${days === 0 ? "today" : `${days} days left`}). Responsible: **${r.responsibleName}**\n`;
    });

    if (count > limit) {
      answer += `\n*and **${count - limit}** more — check the dashboard table for the full list.*`;
    }
    return answer;
  }

  // Match 3: Expiring this month
  if (q.includes("this month") || q.includes("expire this month") || q.includes("expiring this month")) {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const thisMonthItems = reminders.filter(r => {
      if (!r.expiryDate) return false;
      const d = new Date(r.expiryDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    if (thisMonthItems.length === 0) {
      return "📅 There are **no items** expiring in the current month.";
    }

    const count = thisMonthItems.length;
    const limit = 6;
    const displayed = thisMonthItems.slice(0, limit);

    let answer = `### Expiring This Month\nThere are **${count}** item(s) expiring in the current month:\n\n`;
    displayed.forEach(r => {
      const days = getDaysRemainingLocal(r.expiryDate);
      const statusText = days < 0 ? "Overdue" : days === 0 ? "Today" : `${days} days left`;
      answer += `- **${r.itemName}** (${r.category}) — Due on **${formatDateFriendlyLocal(r.expiryDate)}** (${statusText}). Responsible: **${r.responsibleName}**\n`;
    });

    if (count > limit) {
      answer += `\n*and **${count - limit}** more — check the dashboard table for the full list.*`;
    }
    return answer;
  }

  // Match 4: Category distribution/most reminders
  if (q.includes("category with the most") || q.includes("which category") || q.includes("most reminders") || q.includes("popular category") || q.includes("categories")) {
    const catCounts: { [key: string]: number } = {};
    reminders.forEach(r => {
      const cat = r.category || "Uncategorized";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length === 0) {
      return "No categories found in the database.";
    }

    const [topCat, topCount] = sortedCats[0];
    let answer = `### Category Summary\nThe category with the most reminders is **${topCat}** with **${topCount}** item(s).\n\n**Full Category Breakdown:**\n`;
    sortedCats.forEach(([cat, count]) => {
      answer += `- **${cat}**: ${count} item(s)\n`;
    });
    return answer;
  }

  // Match 5: Person-specific questions
  const matchedPerson = uniquePersons.find(p => q.includes(p.toLowerCase()));
  if (matchedPerson || q.includes("responsible") || q.includes("assigned to")) {
    const targetPerson = matchedPerson || "Pranav K";
    const personItems = reminders.filter(r => r.responsibleName.toLowerCase() === targetPerson.toLowerCase());

    if (personItems.length === 0) {
      return `👤 **${targetPerson}** has **no active obligations** assigned to them.`;
    }

    const count = personItems.length;
    const limit = 6;
    const displayed = personItems.slice(0, limit);

    let answer = `### Obligations for **${targetPerson}**\n**${targetPerson}** is responsible for **${count}** item(s):\n\n`;
    displayed.forEach(r => {
      const days = getDaysRemainingLocal(r.expiryDate);
      const statusText = days < 0 ? "Overdue" : days <= 30 ? "Due soon" : "Active";
      answer += `- **${r.itemName}** (${r.category}) — Due on **${formatDateFriendlyLocal(r.expiryDate)}** (**${statusText}**)\n`;
    });

    if (count > limit) {
      answer += `\n*and **${count - limit}** more — check the dashboard table for the full list.*`;
    }
    return answer;
  }

  // Match 6: Category specific questions
  const matchedCategory = uniqueCategories.find(c => q.includes(c.toLowerCase()));
  if (matchedCategory) {
    const catItems = reminders.filter(r => r.category.toLowerCase() === matchedCategory.toLowerCase());

    if (catItems.length === 0) {
      return `📁 The category **${matchedCategory}** contains no active obligations.`;
    }

    const count = catItems.length;
    const limit = 6;
    const displayed = catItems.slice(0, limit);

    let answer = `### Category: **${matchedCategory}**\nThere are **${count}** item(s) in this category:\n\n`;
    displayed.forEach(r => {
      const days = getDaysRemainingLocal(r.expiryDate);
      const statusText = days < 0 ? "Overdue" : days <= 30 ? "Due soon" : "Active";
      answer += `- **${r.itemName}** — Due on **${formatDateFriendlyLocal(r.expiryDate)}** (**${statusText}**). Assigned to: **${r.responsibleName}**\n`;
    });

    if (count > limit) {
      answer += `\n*and **${count - limit}** more — check the dashboard table for the full list.*`;
    }
    return answer;
  }

  // Match 7: Status check for a specific item
  const matchedItem = reminders.find(r => q.includes(r.itemName.toLowerCase()));
  if (matchedItem) {
    const days = getDaysRemainingLocal(matchedItem.expiryDate);
    const overdueText = days < 0 ? `(Overdue by ${Math.abs(days)} days)` : `(${days} days remaining)`;
    return `### Status of **${matchedItem.itemName}**
- **Category**: ${matchedItem.category || "N/A"}
- **Status**: **${matchedItem.status || "Active"}**
- **Expiry Date**: ${formatDateFriendlyLocal(matchedItem.expiryDate)} ${overdueText}
- **Renewal Date**: ${formatDateFriendlyLocal(matchedItem.renewalDate)}
- **Responsible**: ${matchedItem.responsibleName} (${matchedItem.responsibleEmail || "No Email"})
- **Notes**: ${matchedItem.notes || "*No notes available*"}`;
  }

  // Match 8: Pending renewals
  if (q.includes("pending renewal") || q.includes("pending") || q.includes("not done")) {
    const pending = reminders.filter(r => r.status !== "Renewed");

    if (pending.length === 0) {
      return "✅ **All obligations are healthy or fully renewed!** There are no items pending renewal.";
    }

    const count = pending.length;
    const limit = 6;
    const displayed = pending.slice(0, limit);

    let answer = `### Pending Renewals\nThere are **${count}** item(s) pending renewal/action:\n\n`;
    displayed.forEach(r => {
      const days = getDaysRemainingLocal(r.expiryDate);
      const daysText = days < 0 ? "Overdue" : `${days} days left`;
      answer += `- **${r.itemName}** (${r.category}) — Due **${formatDateFriendlyLocal(r.expiryDate)}** (${daysText}). Assigned: **${r.responsibleName}**\n`;
    });

    if (count > limit) {
      answer += `\n*and **${count - limit}** more — check the dashboard table for the full list.*`;
    }
    return answer;
  }

  // Match 9: Overdue the longest
  if (q.includes("overdue the longest") || q.includes("longest overdue")) {
    const overdue = reminders
      .filter(r => {
        const days = getDaysRemainingLocal(r.expiryDate);
        return days < 0 || r.status === "Expired";
      })
      .sort((a, b) => getDaysRemainingLocal(a.expiryDate) - getDaysRemainingLocal(b.expiryDate));

    if (overdue.length === 0) {
      return "There are no overdue items in the database!";
    }

    const longest = overdue[0];
    const days = Math.abs(getDaysRemainingLocal(longest.expiryDate));
    return `### Longest Overdue Obligation
The item overdue the longest is **${longest.itemName}** (${longest.category}):
- **Due Date**: ${formatDateFriendlyLocal(longest.expiryDate)} (**${days} days overdue**)
- **Responsible**: ${longest.responsibleName} (${longest.responsibleEmail || "No Email"})
- **Notes**: ${longest.notes || "*No notes available*"}`;
  }

  // Match 10: How are things looking?
  if (q.includes("how are things looking") || q.includes("status overview") || q.includes("updates") || q.includes("any updates") || q.includes("look") || q.includes("summary") || q.includes("overview")) {
    let overdueCount = 0;
    let soonCount = 0;
    let healthyCount = 0;

    reminders.forEach(r => {
      const days = getDaysRemainingLocal(r.expiryDate);
      if (days < 0 || r.status === "Expired") {
        overdueCount++;
      } else if (days <= 30) {
        soonCount++;
      } else {
        healthyCount++;
      }
    });

    const total = reminders.length;
    const healthPercent = total > 0 ? Math.round(((healthyCount + soonCount) / total) * 100) : 100;

    return `### 📊 Dashboard Status Overview
Here is a quick summary of the **${total}** obligations in your database:
- 🔴 **Overdue**: **${overdueCount}** item(s)
- 🟡 **Expiring in 30 Days**: **${soonCount}** item(s)
- 🟢 **Healthy / Active**: **${healthyCount}** item(s)

**Database Health Rating**: **${healthPercent}%** of obligations are on track or healthy. ${
      overdueCount > 0 
        ? "⚠️ *Please review the overdue items first to avoid compliance or operational penalties.*" 
        : "✅ *Great job! All tracked obligations are currently in good standing.*"
    }`;
  }

  // Match 11: Out of scope blocker
  const isGreeting = q.includes("hello") || q.includes("hi") || q.includes("hey") || q.includes("who are you") || q.includes("help");
  if (!isGreeting && (
    q.includes("weather") || 
    q.includes("joke") || 
    q.includes("president") || 
    q.includes("capital") || 
    q.includes("news") || 
    q.includes("sports") ||
    q.includes("game")
  )) {
    return "I am your dedicated Expiry Manager chatbot and can only assist you with tracking business obligations, expiry dates, categories, and responsible team members in this application.\n\nTry asking me:\n- *\"What's overdue?\"*\n- *\"How are things looking?\"*\n- *\"What is Pranav K responsible for?\"*";
  }

  return null;
}

const SUGGESTIONS = [
  { text: "What's overdue?", icon: AlertTriangle, color: "text-red-500 bg-red-50" },
  { text: "What's due this week?", icon: Clock, color: "text-amber-500 bg-amber-50" },
  { text: "Which category has the most reminders?", icon: HelpCircle, color: "text-blue-500 bg-blue-50" },
  { text: "How are things looking?", icon: Sparkles, color: "text-indigo-500 bg-indigo-50 animate-pulse" }
];

export default function Chatbot({ reminders, chatbotLogo }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI Configuration/Status state
  const [aiStatus, setAiStatus] = useState<{
    loaded: boolean;
    geminiConfigured: boolean;
    error: string | null;
    isStaticSiteError: boolean;
    isSleepingError: boolean;
  }>({
    loaded: false,
    geminiConfigured: true,
    error: null,
    isStaticSiteError: false,
    isSleepingError: false,
  });

  // Check the AI setup status on mount
  useEffect(() => {
    async function checkAiStatus() {
      try {
        const response = await fetch("/api/status");
        if (response.status === 404) {
          setAiStatus({
            loaded: true,
            geminiConfigured: false,
            error: "404 Not Found",
            isStaticSiteError: true,
            isSleepingError: false
          });
          return;
        }
        if (response.status >= 500) {
          setAiStatus({
            loaded: true,
            geminiConfigured: false,
            error: `Server Error (HTTP ${response.status})`,
            isStaticSiteError: false,
            isSleepingError: true
          });
          return;
        }
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          setAiStatus({
            loaded: true,
            geminiConfigured: false,
            error: "Received HTML/text response instead of JSON status. The custom full-stack backend router might not be running or is routed to index.html.",
            isStaticSiteError: true,
            isSleepingError: false
          });
          return;
        }

        const data = await response.json();
        setAiStatus({
          loaded: true,
          geminiConfigured: data.geminiConfigured !== false,
          error: data.geminiConfigured === false ? "GEMINI_API_KEY is not set on the server" : null,
          isStaticSiteError: false,
          isSleepingError: false
        });
      } catch (err: any) {
        console.error("Failed to fetch server AI status:", err);
        const isNetworkOrTimeout = !err.status || err.message?.includes("fetch") || err.message?.includes("NetworkError");
        setAiStatus({
          loaded: true,
          geminiConfigured: false,
          error: err.message || "Could not reach full-stack backend server",
          isStaticSiteError: false,
          isSleepingError: isNetworkOrTimeout // Potential cold start/sleeping server
        });
      }
    }
    checkAiStatus();
  }, []);

  // Initialize with a welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "model",
          text: "Hello! I am your Expiry Manager AI Assistant. I have real-time access to your current business obligations database.\n\nAsk me anything! For example:\n- *What's overdue?*\n- *Which reminders are assigned to which person?*\n- *How many items are expiring this month?*",
          timestamp: new Date()
        }
      ]);
    }
  }, [messages]);

  // Listen to successful voice command executions to log responses in the Chatbot chat
  useEffect(() => {
    const handleVoiceExecuted = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || !customEvent.detail.text) return;
      const text = customEvent.detail.text;
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "model",
          text: text,
          timestamp: new Date()
        }
      ]);
    };

    window.addEventListener("voice-command-executed", handleVoiceExecuted);
    return () => {
      window.removeEventListener("voice-command-executed", handleVoiceExecuted);
    };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const question = (textToSend || input).trim();
    if (!question) return;

    if (!textToSend) {
      setInput("");
    }

    const userMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      text: question,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const isCommandKeyword = /^\s*(please\s+|can\s+you\s+|hey\s+|could\s+you\s+)?\s*(create|add|renew|acknowledge|mark|search|filter|show|update)\b/i.test(question);
    if (isCommandKeyword) {
      // Show short feedback bubble in Chatbot
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "model",
          text: `🤖 **Command recognized!** Opening the Voice Control Center to execute your request: *"${question}"*...`,
          timestamp: new Date()
        }
      ]);
      setIsLoading(false);
      
      // Dispatch custom trigger event after a tiny delay
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('trigger-voice-command', { detail: { text: question } }));
      }, 300);
      return;
    }

    // 1. Try to answer locally first if it matches standard patterns to save Gemini daily quota
    const directLocalAnswer = analyzeQuestionLocally(question, reminders);
    if (directLocalAnswer) {
      // Small artificial delay to feel natural
      await new Promise(resolve => setTimeout(resolve, 350));
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "model",
          text: directLocalAnswer,
          timestamp: new Date()
        }
      ]);
      setIsLoading(false);
      return;
    }

    // 2. If no direct local match, attempt to call the full-stack server-side Gemini endpoint
    try {
      const chatHistory = messages
        .filter(m => m.id !== "welcome")
        .map(m => ({
          role: m.role,
          message: m.text
        }));

      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: chatHistory
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textSample = await response.text().then(t => t.substring(0, 120).trim()).catch(() => "Empty response");
        throw new Error(`Server returned a non-JSON response (HTTP ${response.status}). If you deployed on Vercel/Render as a Static Site instead of a full-stack Web Service, the backend routes are unreachable.\nDetails: "${textSample}"`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response from Gemini");
      }

      const data = await response.json();
      
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "model",
          text: data.answer || "No response received.",
          timestamp: new Date()
        }
      ]);
    } catch (err: any) {
      console.warn("Gemini API error (falling back to client-side reasoning):", err);
      
      const errorDetail = err?.message || String(err);
      
      // Since Gemini failed (possibly due to 429/quota limits or network offline), 
      // compute a highly accurate local query fallback so the user always gets their data!
      const isQuotaExceeded = errorDetail && (
        errorDetail.includes("quota") || 
        errorDetail.includes("429") || 
        errorDetail.includes("limit") || 
        errorDetail.includes("RESOURCE_EXHAUSTED")
      );

      const localFallback = analyzeQuestionLocally(question, reminders) || analyzeQuestionLocally("status overview", reminders);
      
      const fallbackMsg = isQuotaExceeded
        ? `⚠️ **Gemini API Daily Quota Limit Reached (Free Tier).**\n\n*Technical Details:* \`${errorDetail}\`\n\nTo make sure you get uninterrupted access, I've analyzed your question and computed the exact live response locally from your active obligations database:\n\n${localFallback}`
        : `⚠️ **Chatbot Unavailable: Connection to Gemini AI backend failed.**\n\n*Technical Details:* \`${errorDetail}\`\n\nI've fallen back to browser-side local analysis of your active obligations database to answer your question:\n\n${localFallback}`;

      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "model",
          text: fallbackMsg,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "model",
        text: "Chat cleared. Ask me anything about your business obligations database!",
        timestamp: new Date()
      }
    ]);
  };

  // Helper functions for simple markdown formatting inside chat bubbles
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="font-mono text-[10.5px] bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-bold">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return (
      <div className="space-y-1.5">
        {lines.map((line, idx) => {
          let trimmed = line.trim();
          
          if (trimmed.startsWith("### ")) {
            return <h4 key={idx} className="font-bold text-gray-900 mt-2 text-[12px]">{renderInline(trimmed.slice(4))}</h4>;
          }
          if (trimmed.startsWith("## ")) {
            return <h3 key={idx} className="font-bold text-gray-900 mt-2.5 text-[13px] border-b border-gray-100 pb-0.5">{renderInline(trimmed.slice(3))}</h3>;
          }
          if (trimmed.startsWith("# ")) {
            return <h2 key={idx} className="font-bold text-gray-900 mt-3 text-[14px]">{renderInline(trimmed.slice(2))}</h2>;
          }
          
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1.5">
                <span className="text-indigo-500 mt-1 shrink-0 text-sm leading-none">•</span>
                <span className="text-gray-700">{renderInline(trimmed.substring(2))}</span>
              </div>
            );
          }
          
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1.5">
                <span className="text-indigo-600 font-bold shrink-0 text-xs">{numMatch[1]}.</span>
                <span className="text-gray-700">{renderInline(numMatch[2])}</span>
              </div>
            );
          }

          if (trimmed.startsWith("|")) {
            return (
              <div key={idx} className="font-mono text-[10px] bg-gray-50/75 p-1 rounded border border-gray-100 overflow-x-auto whitespace-pre leading-normal my-1 text-gray-600">
                {trimmed}
              </div>
            );
          }

          if (trimmed === "") {
            return <div key={idx} className="h-1" />;
          }

          return <p key={idx} className="text-gray-700">{renderInline(line)}</p>;
        })}
      </div>
    );
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center cursor-pointer group"
        title="Ask Chatbot Assistant"
        id="btn-chatbot-toggle"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform duration-300" />
        ) : (
          <div className="relative">
            <MessageSquare className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          </div>
        )}
      </button>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-24 right-6 z-50 w-[380px] sm:w-[420px] h-[550px] bg-white rounded-2xl border border-gray-100 shadow-2xl flex flex-col overflow-hidden animate-fade-in"
          id="panel-chatbot"
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              {chatbotLogo ? (
                <img
                  src={chatbotLogo}
                  alt="Assistant Logo"
                  className="w-8 h-8 rounded-lg object-cover border border-white/20 shadow-xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-white/15 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  CB
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold tracking-tight">AI Expiry Assistant</h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-blue-100 font-semibold uppercase tracking-wider">Grounded in database</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={clearChat}
                className="p-1.5 hover:bg-white/10 rounded-lg text-blue-100 hover:text-white transition-colors cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-blue-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* AI Status Warning Banner */}
          {aiStatus.loaded && !aiStatus.geminiConfigured && (
            <div className="bg-amber-50 border-b border-amber-200 p-3.5 flex gap-2.5 text-[11px] text-amber-900 leading-normal font-medium shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
              <div>
                {aiStatus.isStaticSiteError ? (
                  <>
                    <span className="font-extrabold text-amber-950 block text-xs">⚠️ Render Static Site Detected!</span>
                    <span className="block mt-1 text-amber-800">
                      The server returned a <strong>404 Not Found</strong>. This happens when the app is deployed as a <em>Static Site</em> instead of a <strong>Web Service</strong>.
                    </span>
                    <span className="block mt-1.5 text-amber-700 bg-amber-100/50 p-2 rounded border border-amber-200/50">
                      <strong>How to fix:</strong> Delete this Static Site on Render, and create a new <strong>Web Service</strong>. Connect your repository, set the Start Command to <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded">npm start</code>, and add the required environment variables in the <em>Environment</em> tab.
                    </span>
                  </>
                ) : aiStatus.isSleepingError ? (
                  <>
                    <span className="font-extrabold text-amber-950 block text-xs">⏳ Server Cold Start / Sleeping</span>
                    <span className="block mt-1 text-amber-800">
                      Could not establish a connection to the full-stack Express server. If this app is on Render's free tier, the backend spins down during inactivity.
                    </span>
                    <span className="block mt-1.5 text-amber-700">
                      <strong>How to fix:</strong> Please wait <strong>30-60 seconds</strong> for the server to wake up, then refresh this page to connect the AI chatbot.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-extrabold text-amber-950 block text-xs">⚠️ GEMINI_API_KEY Not Configured</span>
                    <span className="block mt-1 text-amber-800">
                      The chatbot is running in <strong>Local Analysis Mode</strong>. It will perform reasoning directly inside your browser instead of using full Gemini intelligence.
                    </span>
                    <span className="block mt-1.5 text-amber-700 bg-amber-100/50 p-2 rounded border border-amber-200/50">
                      <strong>How to fix:</strong> Go to your Render Service Dashboard &rarr; <strong>Environment</strong> tab, add the environment variable <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded">GEMINI_API_KEY</code> with your Gemini key, and click <strong>"Clear build cache & deploy"</strong>.
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
            {messages.map((m) => (
              <div 
                key={m.id}
                className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                {m.role === "user" ? (
                  <div className="p-1.5 rounded-lg shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 font-bold text-xs">
                    U
                  </div>
                ) : chatbotLogo ? (
                  <img
                    src={chatbotLogo}
                    alt="Chatbot Avatar"
                    className="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="rounded-lg shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs">
                    CB
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`flex flex-col max-w-[78%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`p-3 rounded-2xl shadow-2xs text-xs ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none font-medium"
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-none leading-relaxed"
                  }`}>
                    {m.role === "user" ? m.text : renderMarkdown(m.text)}
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 px-1">
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex gap-2.5">
                {chatbotLogo ? (
                  <img
                    src={chatbotLogo}
                    alt="Chatbot Avatar"
                    className="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="rounded-lg shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs">
                    CB
                  </div>
                )}
                <div className="bg-white border border-gray-100 p-3.5 rounded-2xl rounded-tl-none shadow-2xs flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                  Gemini is analyzing reminders...
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Area */}
          {messages.length <= 1 && !isLoading && (
            <div className="p-3 bg-white border-t border-gray-100 space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Click to ask:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {SUGGESTIONS.map((s, index) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSend(s.text)}
                      className={`text-left p-2 rounded-xl text-[11px] font-semibold transition-all border border-gray-100 hover:border-indigo-100 hover:shadow-3xs flex items-center gap-1.5 ${s.color} hover:brightness-95 cursor-pointer`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{s.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input Box Footer */}
          <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
            <VoiceCommandButton 
              reminders={reminders} 
              isEmbedded={true} 
              onTranscriptReceived={(text) => setInput(text)} 
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              placeholder="Ask me or type a command..."
              className="flex-1 bg-gray-50 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer shadow-sm shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
