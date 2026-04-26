import { useState, useRef } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { 
  Rocket, 
  BarChart3, 
  Target, 
  FileText, 
  Layers, 
  TrendingUp, 
  Loader2, 
  Send, 
  HelpCircle, 
  ChevronRight, 
  CheckCircle2,
  AlertCircle,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MarketAnalysis {
  tam: string;
  sam: string;
  som: string;
  marketSizingTable: { segment: string; volume: number; price: number; total: string }[];
  competitors: { name: string; weakness: string }[];
  unfairAdvantage: string;
}

interface ValueProposition {
  jtbd: string;
  leanCanvas: {
    problem: string;
    solution: string;
    keyMetrics: string;
    costStructure: string;
    revenueStreams: string;
  };
}

interface PRD {
  userStories: string[];
  kpis: string[];
  technicalConstraints: string[];
  fullDraft: string; // For the Drafting Canvas
}

interface MVPRoadmap {
  mvpScope: string;
  roadmap: { week: number; focus: string; deliverables: string[]; riceScore: number }[];
  prioritizationMatrix: { feature: string; reach: number; impact: number; confidence: number; effort: number; score: number }[];
}

interface GrowthTesting {
  abTest: { 
    nullHypothesis: string; 
    alternativeHypothesis: string; 
    testDesign: string; 
    successMetric: string 
  };
  interviewScripts: string[];
  experimentLab: { testName: string; status: string; learning: string }[];
  feedbackLog: { user: string; feedback: string; sentiment: "positive" | "neutral" | "negative" }[];
}

interface GrowthStrategy {
  growthLoops: { name: string; description: string }[];
  gtmStrategy: { channel: string; tactic: string }[];
}

interface Strategy {
  marketAnalysis: MarketAnalysis;
  valueProposition: ValueProposition;
  prd: PRD;
  mvpRoadmap: MVPRoadmap;
  growthTesting: GrowthTesting;
  growthStrategy: GrowthStrategy;
}

interface AIResponse {
  type: "strategy" | "clarification" | "analysis";
  strategy?: Strategy;
  analysis?: {
    painPoints: string[];
    recommendations: { feature: string; rationale: string; riceImpact: string }[];
  };
  questions?: string[];
  reasoning?: string;
}

const SYSTEM_INSTRUCTION = `You are a Principal Product Manager & Venture Architect. 
Your objective is to transform a raw "Idea" or "Target Audience" into a market-ready product strategy using a 7-Phase Workflow.

The Workflow (Sequential):
1. Market Analysis: Estimate TAM/SAM/SOM. You MUST calculate these based on user-provided pricing and volume estimates if available. If not, estimate based on industry benchmarks. Provide a marketSizingTable.
2. Value Proposition: Define the "Job to be Done" (JTBD) and a Lean Canvas summary.
3. Product Requirements (PRD): Draft a PRD including User Stories, Success Metrics (KPIs), and Technical Constraints. Provide a "fullDraft" string formatted in Markdown for a document editor.
4. MVP & Prototype: Define the "Minimum Viable Product" (MVP) scope and a 4-week build roadmap.
5. Customer Feedback: Outline customer interview scripts and provide a mock "feedbackLog" with 3-5 entries showing potential user reactions and sentiment.
6. A/B Testing: Design A/B tests with Null and Alternative Hypotheses. Outline the experiment lab setup.
7. Growth Strategy: Outline growth loops and viral mechanics.

Operational Rules:
- Use professional GPM terminology (LTV/CAC, North Star Metric, RICE prioritization).
- If the provided idea is too vague, return 3 specific "Clarification Questions" (e.g., "What is the average price per user?", "How many potential users are in the initial target region?").
- For Interview Analysis: If the user provides a transcript, extract "Pain Points" and rank them into a RICE Prioritization matrix.
- If the user provides ONLY a target audience, brainstorm a high-potential product idea for that audience and build the strategy around it.
- PRD ONLY MODE: If the user specifically asks for a PRD, you MUST still return the "strategy" type. Focus your effort on the "prd" field (especially "fullDraft"), but provide brief, logical placeholders for other strategy fields to maintain schema validity.
- ALWAYS return a valid JSON response matching the provided schema.`;

import ReactMarkdown from "react-markdown";

const phases = [
  { id: 0, name: "Market Analysis", icon: BarChart3 },
  { id: 1, name: "Value Prop", icon: Target },
  { id: 2, name: "PRD", icon: FileText },
  { id: 3, name: "MVP Roadmap", icon: Layers },
  { id: 4, name: "Customer Feedback", icon: HelpCircle },
  { id: 5, name: "A/B Testing", icon: TrendingUp },
  { id: 6, name: "Growth Strategy", icon: Rocket },
];

export default function App() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prdRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportPrdToPdf = async () => {
    if (!prdRef.current || !response?.strategy?.prd?.fullDraft) return;
    setIsExportingPdf(true);
    setError(null);
    try {
      const element = prdRef.current;
      const pdf = new jsPDF("p", "mm", "a4");
      
      // Use the modern .html() method which is more robust
      await pdf.html(element, {
        callback: function (doc) {
          doc.save("prd-document.pdf");
          setSuccessMessage("PRD Exported as PDF!");
          setTimeout(() => setSuccessMessage(null), 3000);
          setIsExportingPdf(false);
        },
        x: 10,
        y: 10,
        width: 190, // A4 width is 210mm, so 190mm gives 10mm margins
        windowWidth: 800, // Fixed window width for consistent rendering
        autoPaging: "text",
        html2canvas: {
          scale: 1,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        }
      });
    } catch (err: any) {
      console.error("PDF Export Error:", err);
      setError(`Failed to export PDF: ${err.message || "The document might be too large or complex"}. Please try again.`);
      setIsExportingPdf(false);
    }
  };

  const generateStrategy = async (input: string, isAnalysis = false, isPrdOnly = false) => {
    if (!input.trim()) return;
    console.time("Strategy Generation");
    setLoading(true);
    setError(null);
    if (!isAnalysis) {
      setResponse(null);
      setActivePhase(isPrdOnly ? 2 : 0);
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
      }
      
      const genAI = new GoogleGenAI({ apiKey });
      const model = "gemini-3.1-flash-lite-preview";
      
      let prompt = "";
      if (isAnalysis) {
        prompt = `Analyze this interview transcript and map pain points to the PRD/Roadmap: "${input}"`;
      } else if (isPrdOnly) {
        prompt = `Generate a comprehensive, professional Product Requirements Document (PRD) for this idea. 
        
        CRITICAL INSTRUCTION: You MUST return a "strategy" type response. Do NOT return "clarification" unless the input is completely unintelligible. 
        Focus 90% of your effort on the "prd" field (userStories, kpis, technicalConstraints, and especially the markdown "fullDraft"). 
        The "fullDraft" should be a 1000+ word professional PRD with sections for Overview, User Personas, Functional Requirements, Non-Functional Requirements, and Success Metrics.
        
        Fill other strategy fields (marketAnalysis, valueProposition, mvpRoadmap, growthTesting, growthStrategy) with brief, logical context so the schema is valid.
        
        Idea: "${input}"`;
      } else {
        prompt = `Transform this raw idea into a product strategy. Target Audience: "${input}"`;
      }

      console.log("Generating content for input:", input, "Mode:", isPrdOnly ? "PRD" : "Strategy");
      const result = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["strategy", "clarification", "analysis"] },
              strategy: {
                type: Type.OBJECT,
                properties: {
                  marketAnalysis: {
                    type: Type.OBJECT,
                    properties: {
                      tam: { type: Type.STRING },
                      sam: { type: Type.STRING },
                      som: { type: Type.STRING },
                      marketSizingTable: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            segment: { type: Type.STRING },
                            volume: { type: Type.NUMBER },
                            price: { type: Type.NUMBER },
                            total: { type: Type.STRING }
                          },
                          required: ["segment", "volume", "price", "total"]
                        }
                      },
                      competitors: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            weakness: { type: Type.STRING }
                          },
                          required: ["name", "weakness"]
                        }
                      },
                      unfairAdvantage: { type: Type.STRING }
                    },
                    required: ["tam", "sam", "som", "marketSizingTable", "competitors", "unfairAdvantage"]
                  },
                  valueProposition: {
                    type: Type.OBJECT,
                    properties: {
                      jtbd: { type: Type.STRING },
                      leanCanvas: {
                        type: Type.OBJECT,
                        properties: {
                          problem: { type: Type.STRING },
                          solution: { type: Type.STRING },
                          keyMetrics: { type: Type.STRING },
                          costStructure: { type: Type.STRING },
                          revenueStreams: { type: Type.STRING }
                        },
                        required: ["problem", "solution", "keyMetrics", "costStructure", "revenueStreams"]
                      }
                    },
                    required: ["jtbd", "leanCanvas"]
                  },
                  prd: {
                    type: Type.OBJECT,
                    properties: {
                      userStories: { type: Type.ARRAY, items: { type: Type.STRING } },
                      kpis: { type: Type.ARRAY, items: { type: Type.STRING } },
                      technicalConstraints: { type: Type.ARRAY, items: { type: Type.STRING } },
                      fullDraft: { type: Type.STRING }
                    },
                    required: ["userStories", "kpis", "technicalConstraints", "fullDraft"]
                  },
                  mvpRoadmap: {
                    type: Type.OBJECT,
                    properties: {
                      mvpScope: { type: Type.STRING },
                      roadmap: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            week: { type: Type.NUMBER },
                            focus: { type: Type.STRING },
                            deliverables: { type: Type.ARRAY, items: { type: Type.STRING } },
                            riceScore: { type: Type.NUMBER }
                          },
                          required: ["week", "focus", "deliverables", "riceScore"]
                        }
                      },
                      prioritizationMatrix: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            feature: { type: Type.STRING },
                            reach: { type: Type.NUMBER },
                            impact: { type: Type.NUMBER },
                            confidence: { type: Type.NUMBER },
                            effort: { type: Type.NUMBER },
                            score: { type: Type.NUMBER }
                          },
                          required: ["feature", "reach", "impact", "confidence", "effort", "score"]
                        }
                      }
                    },
                    required: ["mvpScope", "roadmap", "prioritizationMatrix"]
                  },
                  growthTesting: {
                    type: Type.OBJECT,
                    properties: {
                      abTest: {
                        type: Type.OBJECT,
                        properties: {
                          nullHypothesis: { type: Type.STRING },
                          alternativeHypothesis: { type: Type.STRING },
                          testDesign: { type: Type.STRING },
                          successMetric: { type: Type.STRING }
                        },
                        required: ["nullHypothesis", "alternativeHypothesis", "testDesign", "successMetric"]
                      },
                      interviewScripts: { type: Type.ARRAY, items: { type: Type.STRING } },
                      experimentLab: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            testName: { type: Type.STRING },
                            status: { type: Type.STRING },
                            learning: { type: Type.STRING }
                          },
                          required: ["testName", "status", "learning"]
                        }
                      },
                      feedbackLog: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            user: { type: Type.STRING },
                            feedback: { type: Type.STRING },
                            sentiment: { type: Type.STRING, enum: ["positive", "neutral", "negative"] }
                          },
                          required: ["user", "feedback", "sentiment"]
                        }
                      }
                    },
                    required: ["abTest", "interviewScripts", "experimentLab", "feedbackLog"]
                  },
                  growthStrategy: {
                    type: Type.OBJECT,
                    properties: {
                      growthLoops: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            description: { type: Type.STRING }
                          },
                          required: ["name", "description"]
                        }
                      },
                      gtmStrategy: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            channel: { type: Type.STRING },
                            tactic: { type: Type.STRING }
                          },
                          required: ["channel", "tactic"]
                        }
                      }
                    },
                    required: ["growthLoops", "gtmStrategy"]
                  }
                },
                required: ["marketAnalysis", "valueProposition", "prd", "mvpRoadmap", "growthTesting", "growthStrategy"]
              },
              analysis: {
                type: Type.OBJECT,
                properties: {
                  painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  recommendations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        feature: { type: Type.STRING },
                        rationale: { type: Type.STRING },
                        riceImpact: { type: Type.STRING }
                      },
                      required: ["feature", "rationale", "riceImpact"]
                    }
                  }
                },
                required: ["painPoints", "recommendations"]
              },
              questions: { type: Type.ARRAY, items: { type: Type.STRING } },
              reasoning: { type: Type.STRING }
            },
            required: ["type"]
          }
        }
      });

      if (!result.text) {
        throw new Error("The AI returned an empty response. Please try again.");
      }

      let data: AIResponse;
      try {
        data = JSON.parse(result.text) as AIResponse;
      } catch (parseErr) {
        console.error("JSON Parse Error:", parseErr, "Raw text:", result.text);
        throw new Error("Failed to parse the AI response. It might have been cut off or malformed.");
      }
      
      setTimeout(() => {
        console.timeEnd("Strategy Generation");
        if (isAnalysis && data.analysis) {
          setResponse(prev => {
            if (!prev) return data;
            return {
              ...prev,
              analysis: data.analysis
            };
          });
          setActivePhase(4); // Switch to Customer Feedback to see the impact
        } else {
          setResponse(data);
        }

        if (data.type === "strategy") {
          setSuccessMessage(isPrdOnly ? "PRD Document Generated Successfully!" : "Full Venture Strategy Architected!");
          setTimeout(() => setSuccessMessage(null), 5000);
          
          if (isPrdOnly) {
            setActivePhase(2); // Switch to PRD phase (index 2)
          } else if (isAnalysis) {
            setActivePhase(4); // Switch to Customer Feedback (index 4)
          } else {
            setActivePhase(0); // Default to Market Analysis
          }
          
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }, 0);
    } catch (err: any) {
      console.error("Generation error:", err);
      setError(`Failed to generate strategy: ${err.message || "Unknown error"}. Please refine your idea and try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      generateStrategy(content, true);
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Rocket size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">VentureArchitect AI</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Principal PM & Venture Architect</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-emerald-500" /> Professional GPM Workflow</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="space-y-12">
          {/* Input Section */}
          <section>
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Transform Your Raw Idea</h2>
              <p className="text-slate-500 mb-6">Enter your product concept, target market, or problem statement to generate a comprehensive venture strategy.</p>
              
              <div className="relative group">
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="e.g., A subscription-based AI platform for small law firms to automate document discovery and risk assessment..."
                  className="w-full min-h-[160px] p-6 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none text-lg leading-relaxed placeholder:text-slate-400"
                />
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept=".txt,.csv"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all"
                    title="Upload Interview Transcript"
                  >
                    <FileText size={20} />
                  </button>
                  <button
                    onClick={() => generateStrategy(idea, false, true)}
                    disabled={loading || !idea.trim()}
                    className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg active:scale-95"
                    title="Generate Comprehensive PRD"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                    PRD
                  </button>
                  <button
                    onClick={() => generateStrategy(idea)}
                    disabled={loading || !idea.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Architecting...
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Generate Strategy
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>

        {/* Success Message */}
        {successMessage && (
          <div className="fixed top-24 right-8 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-500">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Check size={18} />
              </div>
              <p className="font-bold">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700"
          >
            <AlertCircle size={20} />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Clarification Questions */}
        {response?.type === "clarification" && (
          <div
            className="mb-12 bg-amber-50 border border-amber-100 rounded-3xl p-8"
          >
            <div className="flex items-center gap-3 mb-6 text-amber-800">
              <HelpCircle size={28} />
              <h3 className="text-xl font-bold">Clarification Needed</h3>
            </div>
            <p className="text-amber-900/70 mb-8 font-medium italic">"{response.reasoning}"</p>
            <div className="grid gap-4">
              {response.questions?.map((q, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-amber-200/50 shadow-sm flex items-start gap-4 group hover:border-amber-400 transition-colors cursor-pointer" onClick={() => setIdea(prev => prev + "\n\n" + q)}>
                  <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                  <p className="text-slate-800 font-medium pt-1">{q}</p>
                  <ChevronRight size={20} className="ml-auto text-amber-300 group-hover:text-amber-500 transition-colors" />
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-amber-700/60 text-center">Click a question to add it to your prompt and refine your idea.</p>
          </div>
        )}

        {/* Strategy Output */}
        {response?.type === "strategy" && response.strategy && (
          <div
            ref={scrollRef}
            className="space-y-8"
          >
              {/* Phase Navigation */}
              <div className="flex flex-wrap gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm sticky top-20 z-40">
                {phases.map((phase) => (
                  <button
                    key={phase.id}
                    onClick={() => setActivePhase(phase.id)}
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                      activePhase === phase.id
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    <phase.icon size={18} />
                    {phase.name}
                  </button>
                ))}
              </div>

              {/* Content Area */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                      {(() => {
                        const Icon = phases[activePhase].icon;
                        return <Icon size={24} />;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{phases[activePhase].name}</h3>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Phase {activePhase + 1} of 7</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-400 font-medium">Generated Strategy</p>
                    <p className="text-sm font-bold text-slate-700">VentureArchitect v1.0</p>
                  </div>
                </div>

                <div className="p-8">
                  {/* Phase 1: Market Analysis */}
                  {activePhase === 0 && (
                    <div className="space-y-8">
                      <div className="grid sm:grid-cols-3 gap-6">
                        <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                          <p className="text-xs font-bold text-indigo-600 uppercase mb-1">TAM</p>
                          <p className="text-xl font-bold text-slate-900">{response.strategy.marketAnalysis.tam}</p>
                        </div>
                        <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                          <p className="text-xs font-bold text-blue-600 uppercase mb-1">SAM</p>
                          <p className="text-xl font-bold text-slate-900">{response.strategy.marketAnalysis.sam}</p>
                        </div>
                        <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                          <p className="text-xs font-bold text-emerald-600 uppercase mb-1">SOM</p>
                          <p className="text-xl font-bold text-slate-900">{response.strategy.marketAnalysis.som}</p>
                        </div>
                      </div>

                      {/* Evidence-Based Market Sizing Table */}
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                            <tr>
                              <th className="px-6 py-4">Market Segment</th>
                              <th className="px-6 py-4 text-right">Volume</th>
                              <th className="px-6 py-4 text-right">Price/Unit</th>
                              <th className="px-6 py-4 text-right">Total Opportunity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {response.strategy.marketAnalysis.marketSizingTable.map((row, i) => (
                              <tr key={i} className="bg-white hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">{row.segment}</td>
                                <td className="px-6 py-4 text-right">{row.volume.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right">${row.price}</td>
                                <td className="px-6 py-4 text-right font-bold text-indigo-600">{row.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <Target size={20} className="text-indigo-600" />
                          Competitive Landscape
                        </h4>
                        <div className="grid gap-4">
                          {response.strategy.marketAnalysis.competitors.map((c, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="font-bold text-slate-800">{c.name}</span>
                              <span className="text-sm text-slate-500 italic">Weakness: {c.weakness}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-6 bg-slate-900 text-white rounded-2xl">
                        <h4 className="text-indigo-400 font-bold uppercase text-xs mb-2 tracking-widest">The Unfair Advantage</h4>
                        <p className="text-lg font-medium leading-relaxed">{response.strategy.marketAnalysis.unfairAdvantage}</p>
                      </div>
                    </div>
                  )}

                  {/* Phase 2: Value Proposition */}
                  {activePhase === 1 && (
                    <div className="space-y-8">
                      <div className="p-8 bg-indigo-600 text-white rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                        <h4 className="text-indigo-200 font-bold uppercase text-xs mb-3 tracking-widest">Job To Be Done (JTBD)</h4>
                        <p className="text-2xl font-bold leading-tight italic">"{response.strategy.valueProposition.jtbd}"</p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-6">
                        <div className="space-y-6">
                          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <h5 className="font-bold text-slate-900 mb-2">Problem Statement</h5>
                            <p className="text-slate-600 text-sm leading-relaxed">{response.strategy.valueProposition.leanCanvas.problem}</p>
                          </div>
                          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <h5 className="font-bold text-slate-900 mb-2">Solution Hypothesis</h5>
                            <p className="text-slate-600 text-sm leading-relaxed">{response.strategy.valueProposition.leanCanvas.solution}</p>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <h5 className="font-bold text-indigo-900 mb-2">Key North Star Metrics</h5>
                            <p className="text-indigo-700 text-sm leading-relaxed">{response.strategy.valueProposition.leanCanvas.keyMetrics}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                              <h5 className="font-bold text-emerald-900 text-xs mb-1 uppercase">Revenue</h5>
                              <p className="text-emerald-700 text-xs">{response.strategy.valueProposition.leanCanvas.revenueStreams}</p>
                            </div>
                            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                              <h5 className="font-bold text-rose-900 text-xs mb-1 uppercase">Cost Structure</h5>
                              <p className="text-rose-700 text-xs">{response.strategy.valueProposition.leanCanvas.costStructure}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phase 3: PRD */}
                  {activePhase === 2 && (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-bold flex items-center gap-2">
                          <FileText size={20} className="text-indigo-600" />
                          Product Requirements
                        </h4>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => generateStrategy(idea, false, true)}
                            disabled={loading}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Rocket size={14} />
                            Regenerate PRD
                          </button>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-indigo-600" />
                            Core User Stories
                          </h4>
                          <div className="space-y-3">
                            {response.strategy.prd.userStories.map((story, i) => (
                              <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 flex gap-3">
                                <span className="text-indigo-600 font-bold">#{i + 1}</span>
                                {story}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-8">
                          <div>
                            <h4 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-700">
                              <TrendingUp size={20} />
                              Success Metrics (KPIs)
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {response.strategy.prd.kpis.map((kpi, i) => (
                                <span key={i} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                                  {kpi}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                              <Layers size={20} />
                              Technical Constraints
                            </h4>
                            <ul className="space-y-2">
                              {response.strategy.prd.technicalConstraints.map((constraint, i) => (
                                <li key={i} className="text-sm text-slate-500 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                                  {constraint}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Full PRD Document */}
                      <div className="mt-12 p-8 bg-slate-50 rounded-3xl border border-slate-200">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <FileText size={24} className="text-indigo-600" />
                            Full PRD Document
                          </h4>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(response.strategy!.prd.fullDraft);
                              }}
                              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all flex items-center gap-2"
                            >
                              Copy
                            </button>
                            <button 
                              onClick={exportPrdToPdf}
                              disabled={isExportingPdf}
                              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                              {isExportingPdf ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <FileText size={14} />
                              )}
                              Export PRD (PDF)
                            </button>
                          </div>
                        </div>
                        <div 
                          ref={prdRef}
                          className="prose prose-slate max-w-none markdown-body bg-white p-8 rounded-2xl border border-slate-100 shadow-sm"
                        >
                          <ReactMarkdown>{response.strategy.prd.fullDraft}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phase 4: MVP Roadmap */}
                  {activePhase === 3 && (
                    <div className="space-y-8">
                      <div className="p-6 bg-indigo-900 text-white rounded-2xl">
                        <h4 className="text-indigo-400 font-bold uppercase text-xs mb-2 tracking-widest">Minimum Viable Product (MVP) Scope</h4>
                        <p className="text-lg font-medium leading-relaxed">{response.strategy.mvpRoadmap.mvpScope}</p>
                      </div>

                      {/* RICE Prioritization Matrix */}
                      <div>
                        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <BarChart3 size={20} className="text-indigo-600" />
                          RICE Prioritization Matrix
                        </h4>
                        <div className="overflow-hidden rounded-2xl border border-slate-200">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                              <tr>
                                <th className="px-6 py-4">Feature</th>
                                <th className="px-6 py-4 text-center">Reach</th>
                                <th className="px-6 py-4 text-center">Impact</th>
                                <th className="px-6 py-4 text-center">Conf.</th>
                                <th className="px-6 py-4 text-center">Effort</th>
                                <th className="px-6 py-4 text-center">Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {response.strategy.mvpRoadmap.prioritizationMatrix.map((row, i) => (
                                <tr key={i} className="bg-white hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 font-medium text-slate-900">{row.feature}</td>
                                  <td className="px-6 py-4 text-center">{row.reach}</td>
                                  <td className="px-6 py-4 text-center">{row.impact}</td>
                                  <td className="px-6 py-4 text-center">{row.confidence}%</td>
                                  <td className="px-6 py-4 text-center">{row.effort}</td>
                                  <td className="px-6 py-4 text-center font-bold text-indigo-600">{row.score}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phase 5: Customer Feedback */}
                  {activePhase === 4 && (
                    <div className="space-y-8">
                      {/* Interview Analysis Recommendations */}
                      {response.analysis && (
                        <div
                          className="p-6 bg-amber-50 border border-amber-100 rounded-2xl"
                        >
                          <h4 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-800">
                            <HelpCircle size={20} />
                            Interview Insights & RICE Impact
                          </h4>
                          <div className="space-y-4">
                            {response.analysis.recommendations.map((rec, i) => (
                              <div key={i} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-bold text-slate-900">{rec.feature}</span>
                                  <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded uppercase">{rec.riceImpact}</span>
                                </div>
                                <p className="text-sm text-slate-600">{rec.rationale}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                          <h4 className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp size={20} className="text-indigo-600" />
                            Customer Feedback Log
                          </h4>
                          <div className="grid gap-4">
                            {response.strategy.growthTesting.feedbackLog.map((log, i) => (
                              <div key={i} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                                  log.sentiment === "positive" ? "bg-emerald-100 text-emerald-600" :
                                  log.sentiment === "negative" ? "bg-rose-100 text-rose-600" :
                                  "bg-slate-100 text-slate-600"
                                }`}>
                                  {log.user.charAt(0)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-900">{log.user}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                      log.sentiment === "positive" ? "bg-emerald-50 text-emerald-600" :
                                      log.sentiment === "negative" ? "bg-rose-50 text-rose-600" :
                                      "bg-slate-50 text-slate-600"
                                    }`}>{log.sentiment}</span>
                                  </div>
                                  <p className="text-sm text-slate-600 italic">"{log.feedback}"</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <h5 className="font-bold text-indigo-900 mb-4 text-sm">Customer Interview Scripts</h5>
                            <div className="space-y-4">
                              {response.strategy.growthTesting.interviewScripts.map((script, i) => (
                                <div key={i} className="text-sm text-indigo-700 italic flex gap-2 p-3 bg-white/50 rounded-xl border border-indigo-100/50">
                                  <span className="text-indigo-400 font-serif text-xl leading-none">"</span>
                                  {script}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phase 6: A/B Testing */}
                  {activePhase === 5 && (
                    <div className="space-y-8">
                      <div className="p-8 bg-slate-900 text-white rounded-3xl">
                        <h4 className="text-indigo-400 font-bold uppercase text-xs mb-4 tracking-widest">A/B Testing: Hypotheses</h4>
                        <div className="grid sm:grid-cols-2 gap-8">
                          <div className="space-y-6">
                            <div>
                              <p className="text-xs text-slate-500 font-bold uppercase mb-1">Null Hypothesis (H₀)</p>
                              <p className="text-sm font-medium text-slate-400 italic">"{response.strategy.growthTesting.abTest.nullHypothesis}"</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-bold uppercase mb-1">Alternative Hypothesis (H₁)</p>
                              <p className="text-sm font-medium text-indigo-300 italic">"{response.strategy.growthTesting.abTest.alternativeHypothesis}"</p>
                            </div>
                          </div>
                          <div className="space-y-6">
                            <div>
                              <p className="text-xs text-slate-500 font-bold uppercase mb-1">Test Design</p>
                              <p className="text-sm font-medium text-slate-300">{response.strategy.growthTesting.abTest.testDesign}</p>
                            </div>
                            <div className="pt-4 border-t border-slate-800">
                              <p className="text-xs text-emerald-500 font-bold uppercase mb-1">Success Metric</p>
                              <p className="text-lg font-bold text-emerald-400">{response.strategy.growthTesting.abTest.successMetric}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-lg font-bold flex items-center gap-2">
                          <TrendingUp size={20} className="text-indigo-600" />
                          Live Experiment Tracking
                        </h4>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {response.strategy.growthTesting.experimentLab.map((exp, i) => (
                            <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-800 text-sm">{exp.testName}</span>
                                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-wider">{exp.status}</span>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed"><span className="font-bold text-slate-700">Learning:</span> {exp.learning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phase 7: Growth Strategy */}
                  {activePhase === 6 && (
                    <div className="space-y-8">
                      <div className="grid sm:grid-cols-2 gap-8">
                        <div className="p-8 bg-indigo-900 text-white rounded-3xl">
                          <h4 className="text-indigo-300 font-bold uppercase text-xs mb-4 tracking-widest">Growth Loops & Viral Mechanics</h4>
                          <div className="space-y-6">
                            {response.strategy.growthStrategy.growthLoops.map((loop, i) => (
                              <div key={i} className="p-4 bg-indigo-800/50 rounded-xl border border-indigo-700">
                                <p className="text-xs text-indigo-300 font-bold uppercase mb-2">{loop.name}</p>
                                <p className="text-sm font-medium">{loop.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h4 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <Rocket size={20} className="text-indigo-600" />
                            GTM Strategy & Scaling
                          </h4>
                          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <ul className="space-y-4">
                              {response.strategy.growthStrategy.gtmStrategy.map((gtm, i) => (
                                <li key={i} className="flex gap-3">
                                  <div className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <CheckCircle2 size={12} />
                                  </div>
                                  <p className="text-sm text-slate-600"><span className="font-bold text-slate-800">{gtm.channel}:</span> {gtm.tactic}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-center gap-4 py-8">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all"
                >
                  Export PDF Strategy
                </button>
              </div>
            </div>
          )}

        {/* Empty State / Initial View */}
        {!loading && !response && !error && (
          <div className="grid sm:grid-cols-3 gap-6 mt-12">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 size={20} />
              </div>
              <h4 className="font-bold mb-2">Market Analysis</h4>
              <p className="text-sm text-slate-500">Deep dive into TAM/SAM/SOM and competitive positioning.</p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Target size={20} />
              </div>
              <h4 className="font-bold mb-2">Value Prop</h4>
              <p className="text-sm text-slate-500">Defining the JTBD and Lean Canvas for product-market fit.</p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Layers size={20} />
              </div>
              <h4 className="font-bold mb-2">MVP Roadmap</h4>
              <p className="text-sm text-slate-500">A structured 4-week roadmap to launch your MVP.</p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <HelpCircle size={20} />
              </div>
              <h4 className="font-bold mb-2">Customer Feedback</h4>
              <p className="text-sm text-slate-500">Interview scripts and feedback logs for validation.</p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp size={20} />
              </div>
              <h4 className="font-bold mb-2">A/B Testing</h4>
              <p className="text-sm text-slate-500">Experiment setup and hypothesis tracking.</p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-4">
                <Rocket size={20} />
              </div>
              <h4 className="font-bold mb-2">Growth Strategy</h4>
              <p className="text-sm text-slate-500">Viral loops and scaling mechanics for market dominance.</p>
            </div>
          </div>
        )}
        </div>
      </main>

      <footer className="border-t border-slate-200 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm font-medium">Powered by Gemini 3.1 Pro & VentureArchitect Framework</p>
          <p className="text-slate-300 text-xs mt-2">© 2026 VentureArchitect AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
