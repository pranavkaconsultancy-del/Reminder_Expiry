import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  X, 
  Check, 
  Loader2, 
  AlertTriangle, 
  Calendar, 
  User, 
  Tag, 
  Mail, 
  FileText, 
  Clock, 
  ArrowRight,
  Sparkles,
  HelpCircle,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Reminder, DEFAULT_RENEWAL_PERIODS } from "../types";
import { createReminder, updateReminder } from "../lib/api";

interface VoiceCommandButtonProps {
  reminders: Reminder[];
  onDatabaseChanged?: () => void;
  // If embedded in chatbot, we can optionalize some UI elements
  isEmbedded?: boolean;
  onTranscriptReceived?: (text: string) => void;
}

function calculateNewExpiry(currentExpiryStr: string, periodStr: string): string {
  const expiryDate = new Date(currentExpiryStr);
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

export default function VoiceCommandButton({ 
  reminders, 
  onDatabaseChanged,
  isEmbedded = false,
  onTranscriptReceived
}: VoiceCommandButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  // Parsed command details
  const [parsedCommand, setParsedCommand] = useState<{
    commandType: "create" | "renew" | "search" | "update_status" | "question";
    extractedData?: {
      itemName?: string;
      category?: string;
      expiryDate?: string;
      responsibleName?: string;
      responsibleEmail?: string;
      notes?: string;
      customer_name?: string;
      customer_email?: string;
    };
    searchFilters?: {
      text?: string;
      category?: string;
      status?: string;
    };
    missingFields?: string[];
    followUpQuestion?: string;
  } | null>(null);

  // States for follow up text input or execution
  const [followUpText, setFollowUpText] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSuccess, setExecutionSuccess] = useState("");
  const [answerText, setAnswerText] = useState(""); // For general questions

  // Web Speech API Ref
  const recognitionRef = useRef<any>(null);
  // MediaRecorder Ref for fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Real-time transcription ref to solve stale closure issue
  const realTimeTranscriptionRef = useRef("");
  const updateTranscription = (text: string) => {
    setTranscription(text);
    realTimeTranscriptionRef.current = text;
  };

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecordingSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  useEffect(() => {
    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || !customEvent.detail.text) return;
      const text = customEvent.detail.text;
      
      setIsOpen(true);
      updateTranscription(text);
      setParsedCommand(null);
      setErrorMsg("");
      setAnswerText("");
      processSpokenText(text);
    };
    
    window.addEventListener("trigger-voice-command", handleTrigger);
    return () => {
      window.removeEventListener("trigger-voice-command", handleTrigger);
    };
  }, []);

  const startVoiceCapture = async () => {
    setErrorMsg("");
    updateTranscription("");
    setParsedCommand(null);
    setAnswerText("");
    setIsRecording(true);
    audioChunksRef.current = [];

    // Attempt Web Speech API first for real-time and local execution (saves quota)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const resultText = event.results[0][0].transcript;
          if (resultText) {
            updateTranscription(resultText);
            processSpokenText(resultText);
            stopVoiceCapture(false);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error, falling back to MediaRecorder:", event.error);
          if (event.error === "not-allowed" || event.error === "permission-denied") {
            setErrorMsg("Microphone access needed — please allow it in your browser settings");
          }
        };

        recognition.onend = () => {
          // Do NOT automatically call setIsRecording(false) because MediaRecorder fallback is running
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn("SpeechRecognition start exception, fallback to MediaRecorder only:", err);
      }
    }

    // Always record with MediaRecorder as a solid fallback or parallel stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // If Web Speech API already succeeded and set transcription, we don't need to call STT API
        if (realTimeTranscriptionRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        setIsTranscribing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            try {
              const base64data = reader.result as string;
              const fileBase64 = base64data.split(',')[1];
              
              const res = await fetch("/api/ai/transcribe-voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileBase64, mimeType })
              });

              const contentType = res.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                const textSample = await res.text().then(t => t.substring(0, 100).trim()).catch(() => "Empty response");
                throw new Error(`API returned an unexpected non-JSON response (HTTP ${res.status}). Detail: "${textSample}"`);
              }

              if (!res.ok) {
                throw new Error("Failed to transcribe audio from API");
              }

              const data = await res.json();
              const text = data.text || "";
              updateTranscription(text);
              setIsTranscribing(false);
              if (text.trim()) {
                processSpokenText(text);
              } else {
                setErrorMsg("No speech detected. Please speak clearly into your microphone.");
              }
            } catch (err: any) {
              console.error("STT error:", err);
              setErrorMsg("Failed to transcribe speech: " + err.message);
              setIsTranscribing(false);
            }
          };
        } catch (err: any) {
          console.error("Reader error:", err);
          setErrorMsg("Failed to read audio data.");
          setIsTranscribing(false);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
    } catch (err: any) {
      console.error("Error accessing mic:", err);
      setErrorMsg("Microphone access needed — please allow it in your browser settings");
      setIsRecording(false);
    }
  };

  const stopVoiceCapture = (cancel = false) => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      if (cancel) {
        // Clear chunks so we don't transcribe
        audioChunksRef.current = [];
      }
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processSpokenText = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setErrorMsg("");

    if (onTranscriptReceived) {
      onTranscriptReceived(text);
    }

    try {
      const res = await fetch("/api/ai/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textSample = await res.text().then(t => t.substring(0, 100).trim()).catch(() => "Empty response");
        throw new Error(`API returned an unexpected non-JSON response (HTTP ${res.status}). Detail: "${textSample}"`);
      }

      if (!res.ok) {
        throw new Error("Failed to parse command from AI");
      }

      const parsed = await res.json();
      setParsedCommand(parsed);

      // Handle Immediate (Read-Only) Action: search
      if (parsed.commandType === "search" && parsed.searchFilters) {
        applySearchFilters(parsed.searchFilters);
      } else if (parsed.commandType === "question") {
        // For general questions, ask the chatbot API
        fetchQuestionAnswer(text);
      }
    } catch (err: any) {
      console.error("Parse command error:", err);
      setErrorMsg("AI failed to understand command: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchQuestionAnswer = async (question: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });

      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setAnswerText(data.answer);
      } else {
        setAnswerText("I understood you asked a question, but I couldn't fetch an answer right now.");
      }
    } catch (err) {
      setAnswerText("I was unable to answer this question at the moment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const applySearchFilters = (filters: any) => {
    const searchVal = filters.text || "";
    const catVal = filters.category || "";
    const statusVal = filters.status || "";

    // Dispatch custom event to Dashboard table
    window.dispatchEvent(new CustomEvent('apply-dashboard-filter', {
      detail: {
        search: searchVal,
        category: catVal,
        status: statusVal,
        person: ""
      }
    }));

    setExecutionSuccess("Applied matching search filters to Dashboard table!");
    setTimeout(() => {
      setIsOpen(false);
      setExecutionSuccess("");
    }, 2000);
  };

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpText.trim()) return;
    
    const augmentedText = `${transcription}. ${followUpText}`;
    setTranscription(augmentedText);
    setFollowUpText("");
    processSpokenText(augmentedText);
  };

  const executeConfirmedAction = async () => {
    if (!parsedCommand) return;
    setIsExecuting(true);
    setErrorMsg("");

    try {
      let chatbotMessage = "";
      if (parsedCommand.commandType === "create" && parsedCommand.extractedData) {
        const { itemName, category, expiryDate, responsibleName, responsibleEmail, notes, customer_name, customer_email } = parsedCommand.extractedData;
        
        if (!itemName || !expiryDate) {
          throw new Error("Item name and expiry date are required to create a reminder.");
        }

        // Normalize expiryDate to YYYY-MM-DD format
        let formattedExpiryDate = expiryDate;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
          try {
            const parsedDate = new Date(expiryDate);
            if (!isNaN(parsedDate.getTime())) {
              const y = parsedDate.getFullYear();
              const m = String(parsedDate.getMonth() + 1).padStart(2, "0");
              const d = String(parsedDate.getDate()).padStart(2, "0");
              formattedExpiryDate = `${y}-${m}-${d}`;
            }
          } catch (e) {
            console.error("Failed to parse/normalize expiryDate:", e);
          }
        }

        await createReminder({
          itemName,
          category: category || "Uncategorized",
          expiryDate: formattedExpiryDate,
          responsibleName: responsibleName || "Pranav K",
          responsibleEmail: responsibleEmail || "pranavk.aconsultancy@gmail.com",
          notes: notes || "",
          status: "Active",
          renewalDate: "",
          renewalHistory: [],
          customer_name: customer_name || undefined,
          customer_email: customer_email || undefined
        });

        setExecutionSuccess(`Successfully created reminder: "${itemName}"`);
        chatbotMessage = `Done — reminder '${itemName}' created, expiring on ${formattedExpiryDate}.`;
      } 
      else if (parsedCommand.commandType === "renew" && parsedCommand.extractedData) {
        const { itemName } = parsedCommand.extractedData;
        if (!itemName) throw new Error("Item name to renew was not provided.");

        // Find match in reminders
        const match = reminders.find(r => r.itemName.toLowerCase().includes(itemName.toLowerCase()));
        if (!match) {
          throw new Error(`Could not find an active reminder named "${itemName}" to renew.`);
        }

        const period = DEFAULT_RENEWAL_PERIODS[match.category] || "1 year";
        const newExpiry = calculateNewExpiry(match.expiryDate, period);

        await updateReminder(match.id, {
          expiryDate: newExpiry,
          status: "Active",
          notes: match.notes ? `${match.notes} (Renewed via voice command)` : "Renewed via voice command",
          renewalHistory: [
            ...(match.renewalHistory || []),
            {
              oldExpiryDate: match.expiryDate,
              newExpiryDate: newExpiry,
              renewedBy: "Voice AI",
              renewedOn: new Date().toISOString().split("T")[0]
            }
          ]
        });

        setExecutionSuccess(`Successfully renewed "${match.itemName}"! New expiry: ${newExpiry}`);
        chatbotMessage = `Done — reminder '${match.itemName}' renewed. New expiry: ${newExpiry}.`;
      } 
      else if (parsedCommand.commandType === "update_status" && parsedCommand.extractedData) {
        const { itemName } = parsedCommand.extractedData;
        if (!itemName) throw new Error("Item name is required.");

        const match = reminders.find(r => r.itemName.toLowerCase().includes(itemName.toLowerCase()));
        if (!match) {
          throw new Error(`Could not find a reminder named "${itemName}" to mark as acknowledged.`);
        }

        await updateReminder(match.id, {
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        });

        setExecutionSuccess(`Marked "${match.itemName}" as Acknowledged!`);
        chatbotMessage = `Done — reminder '${match.itemName}' has been marked as acknowledged.`;
      }

      if (chatbotMessage) {
        window.dispatchEvent(new CustomEvent('voice-command-executed', { detail: { text: chatbotMessage } }));
      }

      // Notify App to refresh
      window.dispatchEvent(new CustomEvent('database-changed'));
      if (onDatabaseChanged) {
        onDatabaseChanged();
      }

      setTimeout(() => {
        setIsOpen(false);
        setExecutionSuccess("");
        setParsedCommand(null);
        setTranscription("");
      }, 2500);

    } catch (err: any) {
      console.error("Execution error:", err);
      setErrorMsg(err.message || "Failed to execute voice command.");
    } finally {
      setIsExecuting(false);
    }
  };

  const getFriendlyTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Helper for matching and displaying the target item in renew/acknowledge commands
  const getTargetReminderMatch = () => {
    if (!parsedCommand?.extractedData?.itemName) return null;
    const name = parsedCommand.extractedData.itemName.toLowerCase();
    return reminders.find(r => r.itemName.toLowerCase().includes(name));
  };

  // Render modal content
  const renderModalContent = () => {
    if (isRecording) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute w-24 h-24 bg-red-100 rounded-full animate-ping opacity-60"></div>
            <div className="absolute w-20 h-20 bg-red-200 rounded-full animate-pulse"></div>
            <button 
              onClick={() => stopVoiceCapture(false)}
              className="relative z-10 p-5 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors shadow-lg cursor-pointer"
            >
              <MicOff className="w-8 h-8" />
            </button>
          </div>
          <h3 className="text-lg font-bold text-gray-900 animate-pulse">Listening...</h3>
          <p className="text-xs text-gray-500 mt-2 max-w-xs">
            Speak your command clearly now. Click the microphone above to stop and process.
          </p>
          <div className="mt-4 px-3 py-1 bg-gray-100 rounded-full text-xs font-mono font-bold text-gray-600">
            {getFriendlyTime(recordingSeconds)}
          </div>
          <button 
            onClick={() => stopVoiceCapture(true)} 
            className="mt-6 text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
          >
            Cancel Recording
          </button>
        </div>
      );
    }

    if (isTranscribing) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <h3 className="text-sm font-semibold text-gray-900">Transcribing Speech...</h3>
          <p className="text-xs text-gray-400 mt-1">Converting your voice recording into text via Gemini AI</p>
        </div>
      );
    }

    if (isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
          <h3 className="text-sm font-semibold text-gray-900">Understanding Command...</h3>
          <p className="text-xs text-gray-400 mt-1">Analyzing your spoken intent and extracting parameters</p>
        </div>
      );
    }

    if (executionSuccess) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 animate-bounce">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-green-800">Command Executed Successfully</h3>
          <p className="text-xs text-green-600 mt-1 font-medium">{executionSuccess}</p>
        </div>
      );
    }

    if (parsedCommand) {
      const { commandType, extractedData, missingFields, followUpQuestion } = parsedCommand;
      
      // Check if required fields are missing for 'create'
      const isCreateMissingFields = commandType === "create" && (!extractedData?.itemName || !extractedData?.expiryDate || (missingFields && missingFields.length > 0));

      if (isCreateMissingFields || followUpQuestion) {
        return (
          <div className="p-4">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-4 text-xs text-indigo-800 font-semibold flex gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-indigo-500" />
              <div>
                <p className="font-bold">Spoken Text:</p>
                <p className="italic font-medium text-gray-600 mt-1">"{transcription}"</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-6">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> More Details Needed
              </h4>
              <p className="text-xs font-medium text-gray-700 mt-2 leading-relaxed">
                {followUpQuestion || "I caught your request to create a reminder, but I'm missing some details. Please provide them below:"}
              </p>
            </div>

            <form onSubmit={handleFollowUpSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Your Reply</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={followUpText}
                    onChange={(e) => setFollowUpText(e.target.value)}
                    placeholder="Type the missing details (e.g. 'expiring on Dec 15th')"
                    className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    autoFocus
                  />
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
                  >
                    Reply
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={startVoiceCapture}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" /> Tap mic to speak details
                </button>
                <button 
                  type="button"
                  onClick={() => { setParsedCommand(null); setTranscription(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 font-semibold cursor-pointer"
                >
                  Start Over
                </button>
              </div>
            </form>
          </div>
        );
      }

      // Confirmation Screens
      if (commandType === "create" && extractedData) {
        return (
          <div className="p-4 space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 font-semibold flex gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
              <div>
                <p className="font-bold">Spoken Text (Transcribed):</p>
                <p className="italic font-medium text-gray-600 mt-1">"{transcription}"</p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Confirmation Summary</h4>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <Tag className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="font-semibold text-gray-500 w-24">Item Name:</span>
                  <span className="font-bold text-gray-900">{extractedData.itemName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Database className="w-4 h-4 text-purple-500 shrink-0" />
                  <span className="font-semibold text-gray-500 w-24">Category:</span>
                  <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full text-[10px]">
                    {extractedData.category || "Uncategorized"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold text-gray-500 w-24">Expiry Date:</span>
                  <span className="font-bold text-gray-900">{extractedData.expiryDate}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <User className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-semibold text-gray-500 w-24">Assigned To:</span>
                  <span className="font-bold text-gray-900">{extractedData.responsibleName || "Pranav K"}</span>
                </div>
                {extractedData.responsibleEmail && (
                  <div className="flex items-center gap-2 text-xs">
                    <Mail className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="font-semibold text-gray-500 w-24">Email:</span>
                    <span className="font-medium text-gray-600">{extractedData.responsibleEmail}</span>
                  </div>
                )}
                {extractedData.customer_name && (
                  <div className="flex items-center gap-2 text-xs border-t border-dashed border-gray-100 pt-1.5">
                    <User className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-gray-500 w-24">Customer Name:</span>
                    <span className="font-bold text-indigo-900">{extractedData.customer_name}</span>
                  </div>
                )}
                {extractedData.customer_email && (
                  <div className="flex items-center gap-2 text-xs border-t border-dashed border-gray-100 pt-1.5">
                    <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-gray-500 w-24">Customer Email:</span>
                    <span className="font-medium text-indigo-800">{extractedData.customer_email}</span>
                  </div>
                )}
                {extractedData.notes && (
                  <div className="flex items-start gap-2 text-xs pt-1.5 border-t border-dashed border-gray-100">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span className="font-semibold text-gray-500 w-24">Notes:</span>
                    <span className="font-medium text-gray-600 italic">"{extractedData.notes}"</span>
                  </div>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-500" />
                <span className="text-left leading-snug">Could not create reminder: {errorMsg}</span>
              </div>
            )}

            <div className="text-center text-xs font-semibold text-gray-500 py-1">
              Create this new business obligation?
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setParsedCommand(null); setTranscription(""); }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
                disabled={isExecuting}
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-100"
                disabled={isExecuting}
              >
                {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Create
              </button>
            </div>
          </div>
        );
      }

      if (commandType === "renew" && extractedData) {
        const match = getTargetReminderMatch();
        if (!match) {
          return (
            <div className="p-4 text-center">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-gray-900">Obligation Not Found</h4>
              <p className="text-xs text-gray-500 mt-1">
                Could not find any obligation matching <strong className="text-gray-800">"{extractedData.itemName}"</strong> in your active reminders list.
              </p>
              <button
                onClick={() => { setParsedCommand(null); setTranscription(""); }}
                className="mt-4 px-4 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          );
        }

        const period = DEFAULT_RENEWAL_PERIODS[match.category] || "1 year";
        const newExpiry = calculateNewExpiry(match.expiryDate, period);

        return (
          <div className="p-4 space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 font-semibold flex gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
              <div>
                <p className="font-bold">Spoken Text (Transcribed):</p>
                <p className="italic font-medium text-gray-600 mt-1">"{transcription}"</p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Renewal Request</h4>
              <div className="text-xs">
                <p className="font-semibold text-gray-500">Obligation to Renew:</p>
                <p className="font-bold text-gray-900 mt-0.5">{match.itemName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-gray-100">
                <div>
                  <p className="font-semibold text-gray-500">Current Expiry:</p>
                  <p className="font-bold text-gray-600">{match.expiryDate}</p>
                </div>
                <div>
                  <p className="font-semibold text-indigo-600">New Expiry:</p>
                  <p className="font-bold text-indigo-700 flex items-center gap-1">
                    {newExpiry} <ArrowRight className="w-3 h-3 text-indigo-400" />
                  </p>
                </div>
              </div>
              <div className="text-xs pt-1.5 text-gray-400 font-medium">
                💡 Automatically uses default period <strong className="text-gray-600">"{period}"</strong> for the category <strong className="text-gray-600">"{match.category}"</strong>.
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-500" />
                <span className="text-left leading-snug">Could not renew reminder: {errorMsg}</span>
              </div>
            )}

            <div className="text-center text-xs font-semibold text-gray-500 py-1">
              Confirm renewal of this obligation?
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setParsedCommand(null); setTranscription(""); }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
                disabled={isExecuting}
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-100"
                disabled={isExecuting}
              >
                {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                Confirm Renew
              </button>
            </div>
          </div>
        );
      }

      if (commandType === "update_status" && extractedData) {
        const match = getTargetReminderMatch();
        if (!match) {
          return (
            <div className="p-4 text-center">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-gray-900">Obligation Not Found</h4>
              <p className="text-xs text-gray-500 mt-1">
                Could not find any obligation matching <strong className="text-gray-800">"{extractedData.itemName}"</strong> to acknowledge.
              </p>
              <button
                onClick={() => { setParsedCommand(null); setTranscription(""); }}
                className="mt-4 px-4 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          );
        }

        return (
          <div className="p-4 space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 font-semibold flex gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
              <div>
                <p className="font-bold">Spoken Text (Transcribed):</p>
                <p className="italic font-medium text-gray-600 mt-1">"{transcription}"</p>
              </div>
            </div>

            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Acknowledge Status</h4>
              <div className="text-xs">
                <p className="font-semibold text-gray-500">Obligation to Acknowledge:</p>
                <p className="font-bold text-gray-900 mt-0.5">{match.itemName}</p>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Category:</span>
                  <span className="font-bold text-gray-700">{match.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Expiry Date:</span>
                  <span className="font-bold text-red-600">{match.expiryDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Responsible:</span>
                  <span className="font-bold text-gray-700">{match.responsibleName}</span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-500" />
                <span className="text-left leading-snug">Could not update status: {errorMsg}</span>
              </div>
            )}

            <div className="text-center text-xs font-semibold text-gray-500 py-1">
              Mark this obligation as acknowledged?
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setParsedCommand(null); setTranscription(""); }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
                disabled={isExecuting}
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-100"
                disabled={isExecuting}
              >
                {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Acknowledge
              </button>
            </div>
          </div>
        );
      }

      if (commandType === "question" && answerText) {
        return (
          <div className="p-4 space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800 font-semibold flex gap-2">
              <HelpCircle className="w-4 h-4 shrink-0 text-indigo-500 mt-0.5" />
              <div>
                <p className="font-bold">You asked:</p>
                <p className="italic font-medium text-gray-600 mt-0.5">"{transcription}"</p>
              </div>
            </div>

            <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-xs max-h-64 overflow-y-auto">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-yellow-500" /> Answer
              </h4>
              <div className="text-xs text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
                {answerText}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={startVoiceCapture}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mic className="w-4 h-4" /> Ask another
              </button>
              <button
                onClick={() => { setParsedCommand(null); setTranscription(""); setIsOpen(false); }}
                className="py-2 px-4 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        );
      }
    }

    // Default Starting view (or if error occurred)
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <button
          onClick={startVoiceCapture}
          className="p-6 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-all duration-300 animate-pulse hover:scale-105 cursor-pointer shadow-md mb-4"
        >
          <Mic className="w-10 h-10" />
        </button>
        <h3 className="text-sm font-bold text-gray-900">Voice Control Center</h3>
        <p className="text-xs text-gray-500 mt-1.5 max-w-xs leading-relaxed font-medium">
          Speak natural commands to fully manage compliance records:
        </p>

        <div className="w-full text-left mt-6 space-y-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Example Commands:</p>
          <div className="text-[11px] text-gray-600 space-y-1.5 font-medium">
            <p>🗣️ <strong className="text-gray-800">"Create a reminder named Fire Alarm Check, category Compliance Certificate, expiring on March 15th"</strong></p>
            <p>🗣️ <strong className="text-gray-800">"Renew Building Lease"</strong></p>
            <p>🗣️ <strong className="text-gray-800">"Mark Elevator Servicing as acknowledged"</strong></p>
            <p>🗣️ <strong className="text-gray-800">"Show me all overdue insurance obligations"</strong></p>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-semibold w-full flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="text-left leading-snug">{errorMsg}</span>
          </div>
        )}
      </div>
    );
  };

  if (isEmbedded) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          startVoiceCapture();
        }}
        className="p-2 bg-gray-50 text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
        title="Trigger Voice Command"
        type="button"
      >
        <Mic className="w-4 h-4" />
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Voice AI Command System</span>
                  </div>
                  <button 
                    onClick={() => { stopVoiceCapture(true); setIsOpen(false); }}
                    className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {renderModalContent()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setErrorMsg("");
          setTranscription("");
          setParsedCommand(null);
        }}
        className="px-3 py-1.5 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-700 hover:text-blue-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
        title="Launch Voice Command Center"
      >
        <Mic className="w-3.5 h-3.5" />
        Voice Command
      </button>

      <AnimatePresence>
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => {
              stopVoiceCapture(true);
              setIsOpen(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.93, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-blue-600 shrink-0 animate-pulse" />
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Voice AI Command System</span>
                </div>
                <button 
                  onClick={() => { stopVoiceCapture(true); setIsOpen(false); }}
                  className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              {renderModalContent()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
