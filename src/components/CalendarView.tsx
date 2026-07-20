import React, { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Clock, 
  Tag, 
  User, 
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  X
} from "lucide-react";
import { Reminder } from "../types";

interface CalendarViewProps {
  reminders: Reminder[];
  onEdit: (reminder: Reminder) => void;
}

export default function CalendarView({ reminders, onEdit }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Navigate Months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    setCurrentDate(new Date());
    const todayStr = formatDateString(new Date());
    setSelectedDateStr(todayStr);
  };

  // Format Helper
  const formatDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Days remaining helper
  const getDaysRemaining = (expiryStr: string): number => {
    if (!expiryStr) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryStr);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Get days in month
  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 6 = Saturday)
  const getFirstDayOfMonth = (y: number, m: number) => {
    return new Date(y, m, 1).getDay();
  };

  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  // Generate calendar cells (including leading offset days)
  const daysArray: (Date | null)[] = [];
  
  // Padding cells from previous month
  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthDays = getDaysInMonth(prevMonthYear, prevMonth);
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysArray.push(new Date(prevMonthYear, prevMonth, prevMonthDays - i));
  }

  // Current month's days
  for (let i = 1; i <= totalDays; i++) {
    daysArray.push(new Date(year, month, i));
  }

  // Padding cells for next month to complete the row grid of 7s
  const remainingCells = daysArray.length % 7;
  if (remainingCells > 0) {
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const paddingNeeded = 7 - remainingCells;
    for (let i = 1; i <= paddingNeeded; i++) {
      daysArray.push(new Date(nextMonthYear, nextMonth, i));
    }
  }

  // Find matches on a given date string (YYYY-MM-DD)
  const getItemsForDate = (dateStr: string) => {
    const expires: { reminder: Reminder; type: "expiry" | "renewal"; colorClass: string; label: string }[] = [];
    
    reminders.forEach(r => {
      // Expiry Match
      if (r.expiryDate === dateStr) {
        const days = getDaysRemaining(r.expiryDate);
        let colorClass = "bg-green-500";
        let label = "Healthy Expiry";
        if (days <= 0) {
          colorClass = "bg-red-500";
          label = "Overdue / Expiring Today";
        } else if (days <= 10) {
          colorClass = "bg-amber-500";
          label = "Expiring in <= 10 days";
        }
        expires.push({
          reminder: r,
          type: "expiry",
          colorClass,
          label
        });
      }

      // Renewal Match (Plot on Renewal Date as green dot if it has been renewed)
      if (r.renewalDate && r.renewalDate === dateStr) {
        expires.push({
          reminder: r,
          type: "renewal",
          colorClass: "bg-emerald-600",
          label: "Scheduled Renewal"
        });
      }
    });

    return expires;
  };

  const selectedDateItems = selectedDateStr ? getItemsForDate(selectedDateStr) : [];

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 space-y-6">
      {/* Calendar Header with Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">
              Compliance Timeline Calendar
            </h2>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
              Visualize Expiries &amp; Renewals Monthly
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Indicator */}
          <span className="text-xs font-bold text-gray-800 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 min-w-[140px] text-center">
            {monthNames[month]} {year}
          </span>

          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-white transition-all cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={handleJumpToToday}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-700 hover:text-gray-950 hover:bg-white transition-all cursor-pointer"
              title="Jump to Today"
            >
              Today
            </button>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-white transition-all cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Calendar Grid */}
        <div className="lg:col-span-8 space-y-2">
          {/* Weekday Names */}
          <div className="grid grid-cols-7 text-center border-b border-gray-50 pb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <span key={day} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {day}
              </span>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {daysArray.map((cellDate, idx) => {
              if (!cellDate) return <div key={idx} className="aspect-square bg-gray-50/40 rounded-xl" />;
              
              const dateStr = formatDateString(cellDate);
              const isToday = formatDateString(new Date()) === dateStr;
              const isSelected = selectedDateStr === dateStr;
              const isCurrentMonth = cellDate.getMonth() === month;
              const cellItems = getItemsForDate(dateStr);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`aspect-square p-1 sm:p-2 rounded-xl flex flex-col justify-between items-center transition-all border relative cursor-pointer group hover:scale-103 ${
                    isSelected 
                      ? "bg-blue-50 border-blue-200 text-blue-700 shadow-xs" 
                      : isToday
                        ? "bg-amber-50/70 border-amber-200 text-amber-900"
                        : isCurrentMonth
                          ? "bg-white border-gray-50 text-gray-700 hover:bg-gray-50/60"
                          : "bg-gray-50/50 border-transparent text-gray-300"
                  }`}
                >
                  {/* Day Number */}
                  <span className={`text-xs font-bold ${isToday ? "underline decoration-amber-500 decoration-2 font-black" : ""}`}>
                    {cellDate.getDate()}
                  </span>

                  {/* Urgency Color-Coded Dots (Expiring/Renewed) */}
                  <div className="flex gap-1 justify-center w-full max-w-full overflow-hidden pb-1 h-2 flex-wrap">
                    {cellItems.slice(0, 3).map((item, dotIdx) => (
                      <span 
                        key={dotIdx} 
                        className={`w-1.5 h-1.5 rounded-full ${item.colorClass}`} 
                        title={`${item.reminder.itemName} (${item.label})`}
                      />
                    ))}
                    {cellItems.length > 3 && (
                      <span className="text-[7px] font-bold leading-none text-gray-400 select-none">
                        +{cellItems.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Calendar Side Panel / Detail Viewer */}
        <div className="lg:col-span-4 bg-gray-50 rounded-2xl border border-gray-100 p-4 flex flex-col h-full min-h-[300px]">
          <div className="border-b border-gray-100 pb-3 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Day Inspector
              </span>
            </div>
            {selectedDateStr && (
              <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-1 border border-gray-100 rounded-lg">
                {selectedDateStr}
              </span>
            )}
          </div>

          {!selectedDateStr ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <Calendar className="w-10 h-10 text-gray-200 mb-2.5" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Select any date</p>
              <p className="text-[10px] text-gray-400 mt-1 max-w-[180px] leading-relaxed">
                Click any cell on the calendar grid to inspect expiries or renewal dates.
              </p>
            </div>
          ) : selectedDateItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <CheckCircle2 className="w-8 h-8 text-green-200 mb-2.5" />
              <p className="text-xs font-semibold text-green-700">No Obligations Due</p>
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                There are no expiries or scheduled renewals recorded for this date.
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px] pr-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Obligations ({selectedDateItems.length})
              </p>
              
              <div className="space-y-2.5">
                {selectedDateItems.map((item, idx) => {
                  const { reminder, type, label, colorClass } = item;
                  return (
                    <div 
                      key={idx}
                      className="bg-white border border-gray-100 rounded-xl p-3 shadow-xs space-y-2.5 hover:border-blue-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-gray-900 leading-snug">
                            {reminder.itemName}
                          </p>
                          <span className={`inline-block text-[9px] font-bold uppercase tracking-wider text-white px-1.5 py-0.5 rounded-full mt-1 ${colorClass}`}>
                            {type === "expiry" ? "Expiry" : "Renewal"}
                          </span>
                        </div>
                        <button
                          onClick={() => onEdit(reminder)}
                          className="p-1 rounded-lg hover:bg-blue-50 text-blue-600 transition-all cursor-pointer"
                          title="Open full record in Editor"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {reminder.notes && (
                        <div className="p-2 bg-amber-50/50 border border-amber-100 rounded-lg text-[10px] text-amber-900 leading-normal">
                          <p className="font-bold text-[9px] uppercase tracking-wider text-amber-700 mb-0.5">Notes / Context:</p>
                          <p className="font-medium italic">"{reminder.notes}"</p>
                        </div>
                      )}

                      <div className="space-y-1.5 text-[10px] font-medium text-gray-500 pt-1.5 border-t border-dashed border-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-purple-400 shrink-0" />
                            <span>Category:</span>
                          </div>
                          <span className="font-bold text-gray-700">{reminder.category}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Responsible:</span>
                          </div>
                          <span className="font-bold text-gray-700">{reminder.responsibleName}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Info className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>Status:</span>
                          </div>
                          <span className={`font-bold uppercase tracking-wider text-[8px] px-1 rounded border ${
                            reminder.status === "Active" 
                              ? "bg-green-50 border-green-200 text-green-700" 
                              : reminder.status === "Renewed"
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                : "bg-red-50 border-red-200 text-red-700"
                          }`}>
                            {reminder.status}
                          </span>
                        </div>

                        <div className="pt-1.5 flex flex-col gap-0.5 text-[9px] text-gray-400 italic">
                          <p>📅 Expiry: <strong>{reminder.expiryDate}</strong></p>
                          {reminder.renewalDate && (
                            <p>🔄 Renewal Scheduled: <strong>{reminder.renewalDate}</strong></p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Bottom Color-coding legend matching the Dashboard style */}
      <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
        <span className="text-gray-500 mr-1 font-extrabold">Urgency Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span>Overdue / Expiring Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span>Expiring Within 10 Days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span>Healthy Expiries (&gt;10 Days)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
          <span>Renewals</span>
        </div>
      </div>
    </div>
  );
}
