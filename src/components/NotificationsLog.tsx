import React, { useState, useEffect } from "react";
import { Mail, MessageSquare, Calendar, Trash2, ArrowRight, Eye, RefreshCw, CheckCircle, XCircle, AlertCircle, Info, Settings } from "lucide-react";
import { NotificationLog, RULE_LABELS } from "../types";
import { fetchNotificationLogs, clearNotificationLogs, runTriggerSimulation, SimulationResult, sendTestEmail, sendTestSMS, fetchSmsSettings } from "../lib/api";

interface NotificationsLogProps {
  onRefreshReminders: () => void;
}

export default function NotificationsLog({ onRefreshReminders }: NotificationsLogProps) {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [simulationDate, setSimulationDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  // Selected log for Modal preview of email
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Test email state variables
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("pranavk.aconsultancy@gmail.com");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Test SMS state variables
  const [showTestSmsModal, setShowTestSmsModal] = useState(false);
  const [testSmsNumber, setTestSmsNumber] = useState("+919876543210");
  const [configuredTwilioNumber, setConfiguredTwilioNumber] = useState<string>("");
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [testSmsFeedback, setTestSmsFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchSmsSettings()
      .then((settings) => {
        if (settings && settings.phoneNumber) {
          setConfiguredTwilioNumber(settings.phoneNumber);
        }
      })
      .catch(() => {});
  }, [showTestSmsModal]);

  const isSameAsSendingNumber = React.useMemo(() => {
    if (!testSmsNumber || !testSmsNumber.trim() || !configuredTwilioNumber || !configuredTwilioNumber.trim()) {
      return false;
    }
    const cleanRecipient = testSmsNumber.replace(/\D/g, "");
    const cleanConfigured = configuredTwilioNumber.replace(/\D/g, "");
    if (!cleanRecipient || !cleanConfigured) return false;
    return (
      cleanRecipient === cleanConfigured ||
      (cleanRecipient.length >= 8 && cleanConfigured.endsWith(cleanRecipient)) ||
      (cleanConfigured.length >= 8 && cleanRecipient.endsWith(cleanConfigured))
    );
  }, [testSmsNumber, configuredTwilioNumber]);

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testSmsNumber.trim()) return;
    if (isSameAsSendingNumber) {
      setTestSmsFeedback({
        type: "error",
        message: "This is your configured Twilio sending number. Please enter a different mobile number to receive the test SMS."
      });
      return;
    }
    setIsSendingTestSms(true);
    setTestSmsFeedback(null);
    try {
      const res = await sendTestSMS(testSmsNumber.trim());
      if (res && res.success) {
        setTestSmsFeedback({
          type: "success",
          message: `Test SMS sent successfully to ${res.mobile || testSmsNumber}!`
        });
      } else if (res && res.note) {
        let noteMsg = res.note;
        if (
          noteMsg.includes("21266") ||
          noteMsg.toLowerCase().includes("cannot be the same") ||
          noteMsg.toLowerCase().includes("'to' and 'from'")
        ) {
          noteMsg = "SMS couldn't be sent — destination ('To') and sender ('From') phone numbers cannot be the same. Please enter a different recipient mobile number (e.g. your personal mobile phone) to test receiving the SMS.";
        }
        setTestSmsFeedback({
          type: "error",
          message: noteMsg
        });
      } else {
        setTestSmsFeedback({
          type: "success",
          message: `Test SMS process completed.`
        });
      }
      await loadLogs();
    } catch (err: any) {
      let errMsg = err.message || "Failed to send test SMS. Check Twilio parameters or configuration.";
      if (
        errMsg.includes("21266") ||
        errMsg.toLowerCase().includes("cannot be the same") ||
        errMsg.toLowerCase().includes("'to' and 'from'")
      ) {
        errMsg = "SMS couldn't be sent — destination ('To') and sender ('From') phone numbers cannot be the same. Please enter a different recipient mobile number (e.g. your personal mobile phone) to test receiving the SMS.";
      }
      setTestSmsFeedback({
        type: "error",
        message: errMsg
      });
      await loadLogs();
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress.trim()) return;
    setIsSendingTestEmail(true);
    setTestEmailFeedback(null);
    try {
      await sendTestEmail(testEmailAddress.trim());
      setTestEmailFeedback({
        type: "success",
        message: `Test email sent successfully! Since it is sent from Resend's sandbox email (onboarding@resend.dev), it may land in your Spam, Junk, or Updates folder. Please check those folders and mark it as "Not Spam".`
      });
      await loadLogs(); // reload history logs immediately to show the entry
    } catch (err: any) {
      setTestEmailFeedback({
        type: "error",
        message: err.message || "Failed to send test email. Ensure RESEND_API_KEY is configured in your project secrets."
      });
      await loadLogs(); // reload history logs immediately to show the failed attempt
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const data = await fetchNotificationLogs();
      setLogs(data);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSimulate = async (triggerEmails = false) => {
    if (triggerEmails) {
      setIsDispatching(true);
    } else {
      setIsSimulating(true);
    }
    
    try {
      const res = await runTriggerSimulation(simulationDate, triggerEmails);
      setSimResult(res);
      await loadLogs(); // reload history
      if (triggerEmails) {
        onRefreshReminders(); // reload main table statuses if anything updated
      }
    } catch (err) {
      console.error("Failed to run simulation:", err);
    } finally {
      setIsSimulating(false);
      setIsDispatching(false);
    }
  };

  const handleClearLogs = async () => {
    if (window.confirm("Are you sure you want to clear all notification log history? This action is irreversible.")) {
      try {
        await clearNotificationLogs();
        setLogs([]);
      } catch (err) {
        console.error("Failed to clear logs:", err);
      }
    }
  };

  useEffect(() => {
    loadLogs();
    handleSimulate(false); // run simulation for today on startup
  }, []);

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.reminderName.toLowerCase().includes(q) ||
      log.recipientName.toLowerCase().includes(q) ||
      log.recipientEmail.toLowerCase().includes(q) ||
      (log.recipientMobile && log.recipientMobile.toLowerCase().includes(q)) ||
      log.emailSubject.toLowerCase().includes(q) ||
      (log.channel && log.channel.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6" id="notifications-log-screen">
      {/* Simulation / Checker Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Notification Dispatcher & Simulator
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Check which obligations meet criteria for notifications. Select any date to see what WOULD trigger.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Target Date:</span>
              <input
                type="date"
                value={simulationDate}
                onChange={(e) => setSimulationDate(e.target.value)}
                className="bg-transparent border-0 text-xs font-mono text-gray-800 focus:outline-none focus:ring-0 p-0 cursor-pointer"
              />
            </div>
            
            <button
              onClick={() => {
                setTestEmailFeedback(null);
                setShowTestEmailModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs border border-emerald-700"
              title="Send a quick manual diagnostic email to check Resend configuration"
            >
              <Mail className="w-3.5 h-3.5" />
              Send Test Email
            </button>

            <button
              onClick={() => {
                setTestSmsFeedback(null);
                setShowTestSmsModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs border border-violet-700"
              title="Send a quick manual diagnostic SMS digest to check Twilio configuration"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Send Test SMS
            </button>

            <button
              onClick={() => handleSimulate(false)}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? "animate-spin text-blue-600" : ""}`} />
              Preview Only
            </button>
            
            <button
              onClick={() => handleSimulate(true)}
              disabled={isDispatching}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs border border-blue-700 cursor-pointer transition-colors disabled:opacity-50"
              title="Runs reminder check and immediately dispatches real emails using Resend"
            >
              <Mail className="w-3.5 h-3.5" />
              {isDispatching ? "Dispatching..." : "Run Checks & Send Emails"}
            </button>
          </div>
        </div>

        {/* WOULD trigger preview list */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
            Obligations Triggering Notification on {simulationDate}
          </h4>

          {simResult && simResult.matches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {simResult.matches.map((match, i) => (
                <div key={i} className="p-3.5 bg-gray-50/50 rounded-lg border border-gray-100 flex items-start gap-3">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-xs font-bold text-gray-900 leading-tight">
                      {match.itemName}
                    </span>
                    <span className="block text-[11px] text-gray-400">
                      To: {match.recipient}
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="inline-flex items-center text-[10px] font-medium bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-sm">
                        Rule: {RULE_LABELS[match.rule as keyof typeof RULE_LABELS] || match.rule}
                      </span>
                      <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${
                        match.daysRemaining < 0 
                          ? "bg-red-50 text-red-600 font-bold" 
                          : match.daysRemaining <= 30 
                            ? "bg-amber-50 text-amber-600" 
                            : "bg-green-50 text-green-600"
                      }`}>
                        {match.daysRemaining < 0 
                          ? `Overdue by ${Math.abs(match.daysRemaining)}d` 
                          : `${match.daysRemaining}d left`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-gray-50/30 rounded-lg border border-dashed border-gray-200 text-center text-xs text-gray-400">
              {isSimulating ? "Calculating simulation results..." : "No obligations meet notification criteria for this date."}
            </div>
          )}
        </div>
      </div>

      {/* History Log Section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Dispatched Email Audit Log</h3>
            <p className="text-xs text-gray-500 mt-0.5">Historical log tracking every email processed or sent.</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search sent emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-48"
            />
            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-100 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Clear Logs History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Email & SMS Logs Table */}
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 text-gray-500 font-medium uppercase text-[10px] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Channel</th>
                <th className="py-2.5 px-4">Obligation Name</th>
                <th className="py-2.5 px-4">Recipient</th>
                <th className="py-2.5 px-4">Trigger / Rule</th>
                <th className="py-2.5 px-4">Dispatched At</th>
                <th className="py-2.5 px-4 text-right">Message Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-gray-400 italic">
                    {isLoadingLogs ? "Loading dispatch records..." : "No notification records found matching search filters."}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/30">
                    <td className="py-3 px-4">
                      {log.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3.5 h-3.5" /> Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full" title={log.errorDetail}>
                          <XCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {log.channel === "SMS" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md">
                          <MessageSquare className="w-3 h-3" /> SMS Digest
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                          <Mail className="w-3 h-3" /> Email
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{log.reminderName}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800 flex items-center gap-1.5">
                        {log.recipientName}
                        {log.recipientType === 'customer' ? (
                          <span className="inline-block text-[9px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-sm px-1 py-0.25 tracking-wide">Customer</span>
                        ) : (
                          <span className="inline-block text-[9px] font-extrabold uppercase bg-slate-50 text-slate-600 border border-slate-100 rounded-sm px-1 py-0.25 tracking-wide">Responsible</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {log.channel === "SMS" && log.recipientMobile ? log.recipientMobile : log.recipientEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-700">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded-sm">
                        {RULE_LABELS[log.triggerType as keyof typeof RULE_LABELS] || log.triggerType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-mono text-[10px]">
                      {new Date(log.sentAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-md transition-all cursor-pointer inline-flex items-center gap-1"
                        title={log.channel === "SMS" ? "View Raw SMS Digest" : "View Raw HTML Email Template"}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold">
                          {log.channel === "SMS" ? "Preview SMS" : "Preview Email"}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* API Key Commentary warning alert */}
        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex items-start gap-2.5 text-xs text-blue-700">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
          <div>
            <strong>Developer Note on Email Dispatch:</strong> To send actual emails, specify your Resend API key in your workspace credentials or `.env` file under the <code>RESEND_API_KEY</code> parameter. If not provided or configured as placeholder, the system runs in high-fidelity simulation mode, displaying the formatted HTML and logging successes immediately for debugging.
          </div>
        </div>
      </div>

      {/* Notification Modal Preview (Email or SMS) */}
      {selectedLog && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedLog.channel === "SMS" ? (
                  <MessageSquare className="w-5 h-5 text-violet-600" />
                ) : (
                  <Mail className="w-5 h-5 text-blue-600" />
                )}
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {selectedLog.channel === "SMS" ? "SMS Digest Dispatch Audit" : "HTML Template Dispatch Audit"}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Subject / Reference: {selectedLog.emailSubject}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-md transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Envelope / Header Details */}
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 text-xs text-gray-500 grid grid-cols-1 gap-1">
              <div>
                <strong>Channel:</strong> {selectedLog.channel === "SMS" ? "Twilio SMS Digest" : "Resend Email"}
              </div>
              <div>
                <strong>Recipient:</strong> {selectedLog.recipientName}{" "}
                {selectedLog.channel === "SMS" && selectedLog.recipientMobile ? (
                  <code className="text-violet-700 bg-violet-50 px-1 py-0.5 rounded-sm">{selectedLog.recipientMobile}</code>
                ) : (
                  ` <${selectedLog.recipientEmail}>`
                )}
                {selectedLog.recipientType && (
                  <span className={`inline-block text-[9px] font-bold uppercase ml-2 px-1.5 py-0.5 rounded-sm ${
                    selectedLog.recipientType === 'customer' 
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/50' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200/50'
                  }`}>
                    {selectedLog.recipientType}
                  </span>
                )}
              </div>
              <div><strong>Sent At:</strong> {new Date(selectedLog.sentAt).toUTCString()}</div>
              {selectedLog.errorDetail && (
                <div className="text-red-600 mt-1.5 p-2 bg-red-50 border border-red-100 rounded-md font-mono text-[10px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                  <strong>Delivery Log:</strong> {selectedLog.errorDetail}
                  {(selectedLog.channel === "SMS" || selectedLog.errorDetail.toLowerCase().includes("sms") || selectedLog.errorDetail.toLowerCase().includes("twilio")) && (
                    <div className="mt-2 pt-1 border-t border-red-200/50">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLog(null);
                          window.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tab: "rules", subTab: "sms" } }));
                          window.dispatchEvent(new CustomEvent("open-sms-settings"));
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent("open-sms-settings"));
                          }, 50);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded-md shadow-xs cursor-pointer transition-colors"
                      >
                        <Settings className="w-3 h-3" />
                        Go to Settings → SMS Settings to add Twilio credentials
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Body Canvas */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-100 flex justify-center">
              {selectedLog.channel === "SMS" ? (
                <div className="w-full max-w-sm bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[10px] text-slate-400">
                    <span>SMS Digest Preview</span>
                    <span>{selectedLog.emailBody.length} chars</span>
                  </div>
                  <div className="p-3 bg-violet-900/40 border border-violet-500/30 rounded-xl text-xs leading-relaxed font-mono text-violet-100 whitespace-pre-wrap break-words">
                    {selectedLog.emailBody}
                  </div>
                </div>
              ) : (
                <div className="w-full bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
                  <div
                    className="p-4 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: selectedLog.emailBody }}
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold cursor-pointer transition-colors"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Test Email Modal */}
      {showTestEmailModal && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Send Test Email</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Verify your Resend SMTP / API config</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTestEmailModal(false);
                  setTestEmailFeedback(null);
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-md transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="p-5 space-y-4">
              {testEmailFeedback && (
                <div className={`p-3.5 rounded-lg text-xs border flex items-start gap-2.5 ${
                  testEmailFeedback.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}>
                  {testEmailFeedback.type === "success" ? (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold leading-tight">
                      {testEmailFeedback.type === "success" ? "Success" : "Integration Diagnostics Fail"}
                    </p>
                    <p className="text-[11px] leading-relaxed break-words font-mono bg-white/40 p-1.5 rounded-sm">
                      {testEmailFeedback.message}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-gray-800 bg-white"
                />
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  💡 Due to Resend Sandbox rules, emails to other domains will be safely routed to <strong className="text-gray-600">pranavk.aconsultancy@gmail.com</strong> so you can verify success without paying or registering domains.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowTestEmailModal(false);
                    setTestEmailFeedback(null);
                  }}
                  className="px-3.5 py-1.5 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTestEmail}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs border border-emerald-700 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {isSendingTestEmail ? "Sending..." : "Confirm & Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Test SMS Modal */}
      {showTestSmsModal && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-violet-600" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Send Test SMS Digest</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Verify Twilio SMS integration / simulation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTestSmsModal(false);
                  setTestSmsFeedback(null);
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-md transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendTestSms} className="p-5 space-y-4">
              {testSmsFeedback && (
                <div className={`p-3.5 rounded-lg text-xs border flex items-start gap-2.5 ${
                  testSmsFeedback.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}>
                  {testSmsFeedback.type === "success" ? (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold leading-tight">
                      {testSmsFeedback.type === "success" ? "Success" : "SMS Diagnostic Error"}
                    </p>
                    <p className="text-[11px] leading-relaxed break-words font-mono bg-white/40 p-1.5 rounded-sm">
                      {testSmsFeedback.message}
                    </p>
                    {testSmsFeedback.type === "error" && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowTestSmsModal(false);
                          setTestSmsFeedback(null);
                          window.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tab: "rules", subTab: "sms" } }));
                          window.dispatchEvent(new CustomEvent("open-sms-settings"));
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent("open-sms-settings"));
                          }, 50);
                        }}
                        className="mt-2 text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Go to Settings → SMS Settings
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Recipient Mobile Number (International Format) *
                </label>
                <input
                  type="tel"
                  required
                  value={testSmsNumber}
                  onChange={(e) => setTestSmsNumber(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 text-xs font-mono transition-colors ${
                    isSameAsSendingNumber
                      ? "border-red-400 focus:ring-red-500 bg-red-50/50 text-red-900"
                      : "border-gray-200 focus:ring-blue-500 text-gray-800 bg-white"
                  }`}
                />
                {isSameAsSendingNumber ? (
                  <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1 leading-snug">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    This is your configured Twilio sending number. Please enter a different mobile number to receive the test SMS.
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                    Enter a mobile number different from your Twilio sending number (set in SMS Settings) to receive this test message.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowTestSmsModal(false);
                    setTestSmsFeedback(null);
                  }}
                  className="px-3.5 py-1.5 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTestSms || isSameAsSendingNumber || !testSmsNumber.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-xs border border-violet-700 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {isSendingTestSms ? "Sending..." : "Send Test SMS"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
