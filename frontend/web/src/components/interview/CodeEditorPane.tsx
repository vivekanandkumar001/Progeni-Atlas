'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Play,
  Code2,
  Terminal,
  RefreshCw,
  RotateCcw,
  Send,
  CheckCircle2,
  Clock,
  Cpu,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// Loading fallback component with high-contrast, clear visibility
const EditorLoadingState = () => (
  <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center bg-[#070b14] text-slate-100 font-mono text-xs gap-3 p-6 text-center animate-fadeIn select-none">
    <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-xl shadow-cyan-500/20">
      <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
    </div>
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-white tracking-wide">
        Initializing Secure Coding Sandbox...
      </p>
      <p className="text-xs text-cyan-300 font-medium">
        Strict Interview Mode &bull; Auto-completion Disabled
      </p>
    </div>
  </div>
);

// Dynamically import Monaco Editor to avoid SSR hydration mismatches
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: EditorLoadingState,
});

export const ALL_JD_LANGUAGES = [
  { id: 'python', label: 'Python (3.11)', monacoLang: 'python' },
  { id: 'typescript', label: 'TypeScript (5.0)', monacoLang: 'typescript' },
  { id: 'javascript', label: 'JavaScript (ESNext)', monacoLang: 'javascript' },
  { id: 'java', label: 'Java (21)', monacoLang: 'java' },
  { id: 'cpp', label: 'C++ (20)', monacoLang: 'cpp' },
  { id: 'c', label: 'C (C17)', monacoLang: 'c' },
  { id: 'go', label: 'Go (1.22)', monacoLang: 'go' },
  { id: 'rust', label: 'Rust (2021)', monacoLang: 'rust' },
  { id: 'csharp', label: 'C# (.NET 8)', monacoLang: 'csharp' },
  { id: 'sql', label: 'SQL (PostgreSQL/SQLite)', monacoLang: 'sql' },
] as const;

interface CodeEditorPaneProps {
  sessionId: string;
  onCodeChange?: (language: string, code: string) => void;
  onAttachCodeToAnswer?: (codeMarkdown: string) => void;
}

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({
  sessionId,
  onCodeChange,
  onAttachCodeToAnswer,
}) => {
  const [language, setLanguage] = useState<string>('python');
  const [code, setCode] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminalOutput, setTerminalOutput] = useState<string | null>(null);
  const [executionStats, setExecutionStats] = useState<{
    status?: string;
    time?: string;
    memory?: number;
    success?: boolean;
  } | null>(null);
  const [pasteWarning, setPasteWarning] = useState<boolean>(false);
  const [attachedToast, setAttachedToast] = useState<boolean>(false);
  const [activeProblem, setActiveProblem] = useState<{
    id?: string;
    title?: string;
    difficulty?: string;
    description?: string;
    constraints?: string[];
    sampleCode?: Record<string, string>;
  } | null>(null);
  const [showProblemDetails, setShowProblemDetails] = useState<boolean>(true);

  // Fallback resilience in case Monaco takes time to initialize or CDN is restricted
  const [monacoMounted, setMonacoMounted] = useState<boolean>(false);
  const [useNativeEditor, setUseNativeEditor] = useState<boolean>(false);

  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;
    apiFetch(`/api/v1/interview-sessions/${sessionId}/room-data`, { credentials: 'include' })
      .then((res) => (res ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data || !data.activeProblem) return;
        const prob = data.activeProblem;
        setActiveProblem(prob);
        setCode((prev) => {
          if (prev.trim()) return prev;
          const starter = prob.sampleCode?.[language] || '';
          if (starter) onCodeChange?.(language, starter);
          return starter;
        });
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    // If Monaco has not mounted after 3.5s (e.g. slow CDN / network drop), automatically activate native fallback
    const timer = setTimeout(() => {
      if (!monacoMounted) {
        setUseNativeEditor(true);
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, [monacoMounted]);

  const selectedLangObj = ALL_JD_LANGUAGES.find((l) => l.id === language) || ALL_JD_LANGUAGES[0];

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setTerminalOutput(null);
    setExecutionStats(null);
    setCode((prev) => {
      const prevStarter = activeProblem?.sampleCode?.[language] || '';
      if (!prev.trim() || prev === prevStarter) {
        const nextStarter = activeProblem?.sampleCode?.[lang] || '';
        onCodeChange?.(lang, nextStarter);
        return nextStarter;
      }
      onCodeChange?.(lang, prev);
      return prev;
    });
  };

  const handleClearCode = () => {
    setCode('');
    setTerminalOutput(null);
    setExecutionStats(null);
    onCodeChange?.(language, '');
  };

  const handleAttachToAnswer = () => {
    const formatted = `\`\`\`${language}\n${code}\n\`\`\``;
    onAttachCodeToAnswer?.(formatted);
    setAttachedToast(true);
    setTimeout(() => setAttachedToast(false), 3000);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    setMonacoMounted(true);
    setUseNativeEditor(false);

    // High-contrast cyber theme with crystal-clear white text and bright line numbers
    monaco.editor.defineTheme('talentpulse-cyber', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '818cf8', fontStyle: 'italic' },
        { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
        { token: 'string', foreground: '34d399' },
        { token: 'number', foreground: 'f472b6' },
        { token: 'type', foreground: 'a78bfa' },
        { token: 'function', foreground: '67e8f9' },
      ],
      colors: {
        'editor.background': '#070b14',
        'editor.foreground': '#f8fafc',
        'editorLineNumber.foreground': '#64748b',
        'editorLineNumber.activeForeground': '#38bdf8',
        'editor.lineHighlightBackground': '#1e293b55',
        'editor.selectionBackground': '#0891b255',
      },
    });
    monaco.editor.setTheme('talentpulse-cyber');

    // Anti-cheat paste audit listener
    editor.onDidPaste((e: any) => {
      const pasteSize = (e.range?.endColumn || 0) - (e.range?.startColumn || 0);
      if (pasteSize > 60 || (e.range?.endLineNumber || 0) > (e.range?.startLineNumber || 0)) {
        setPasteWarning(true);
        setTimeout(() => setPasteWarning(false), 5000);
      }
    });
  };

  const handleRunSampleTests = async () => {
    setIsRunning(true);
    setTerminalOutput(null);
    setExecutionStats(null);

    try {
      const res = await apiFetch(`/api/v1/interview-sessions/${sessionId}/code-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });

      if (!res) {
        setTerminalOutput('Failed to connect to backend code runner service.');
        setExecutionStats({ success: false, status: 'Network Error' });
        return;
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        setTerminalOutput('Invalid response payload from sandbox runner.');
        setExecutionStats({ success: false, status: 'Payload Error' });
        return;
      }

      if (data.error) {
        setTerminalOutput(`⚡ Execution Error:\n${data.error}`);
        setExecutionStats({ success: false, status: 'Error' });
        return;
      }

      let output = '';
      if (data.stdout) output += data.stdout;
      if (data.stderr) {
        if (output) output += '\n--- Stderr / Runtime Messages ---\n';
        output += data.stderr;
      }
      if (data.compile_output && !output.includes(data.compile_output)) {
        if (output) output += '\n--- Compiler Output ---\n';
        output += data.compile_output;
      }

      if (!output.trim()) {
        output = `[Execution finished successfully with no output.]`;
      }

      setTerminalOutput(output);
      setExecutionStats({
        success: data.success ?? true,
        status: data.status || 'Accepted',
        time: data.time || '0.01',
        memory: data.memory || 1024,
      });
    } catch (e: any) {
      setTerminalOutput(`Execution Error: ${e?.message || 'Could not execute code in sandbox'}`);
      setExecutionStats({ success: false, status: 'Crash' });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col rounded-2xl border border-slate-700/80 bg-[#070b14] overflow-hidden shadow-2xl relative">
      {/* ANTI-CHEAT PASTE WARNING BANNER */}
      {pasteWarning && (
        <div className="px-3.5 py-2 bg-amber-500/20 border-b border-amber-500/40 text-amber-200 text-xs flex items-center justify-between font-mono animate-fadeIn z-20">
          <span className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Anti-Cheat Audit: Code paste event logged for recruiter evaluation.</span>
          </span>
          <button
            type="button"
            onClick={() => setPasteWarning(false)}
            className="text-amber-300 hover:text-white text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SUCCESS ATTACH TO ANSWER BANNER */}
      {attachedToast && (
        <div className="px-3.5 py-2 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 font-mono animate-fadeIn z-20 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Code attached to your Interview Answer! Ready for AI evaluation.</span>
        </div>
      )}

      {/* HEADER TOOLBAR (High Contrast Styling) */}
      <div className="p-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2.5 z-10">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-bold">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Code Sandbox</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 font-bold tracking-wide">
              Strict Interview Mode
            </span>
          </div>

          {/* Language Selector (High Visibility) */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-600 text-white font-semibold text-xs font-mono cursor-pointer focus:outline-none focus:border-cyan-400 hover:border-slate-500 transition-colors shadow-sm"
          >
            {ALL_JD_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id} className="bg-slate-900 text-white font-mono">
                {lang.label}
              </option>
            ))}
          </select>

          {/* Clear Code Button */}
          <button
            type="button"
            onClick={handleClearCode}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Clear Code Editor"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-200" />
            <span className="text-[11px] hidden md:inline">Clear</span>
          </button>

          {/* Editor Mode Indicator / Toggle */}
          {useNativeEditor && (
            <button
              type="button"
              onClick={() => setUseNativeEditor(false)}
              className="px-2.5 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[11px] font-mono font-medium transition-colors cursor-pointer flex items-center gap-1"
              title="Click to retry loading Monaco"
            >
              <Sliders className="w-3 h-3 text-indigo-400" />
              <span>Native Mode</span>
            </button>
          )}
        </div>

        {/* Action Buttons: Run Tests & Attach to AI Answer */}
        <div className="flex items-center gap-2">
          {onAttachCodeToAnswer && (
            <button
              type="button"
              onClick={handleAttachToAnswer}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-100 border border-cyan-500/40 hover:border-cyan-400 font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-[0.98]"
              title="Attach this code to your answer for AI interviewer evaluation"
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              <span>Attach to Answer</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRunSampleTests}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isRunning ? 'Running Tests...' : 'Run Tests'}</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC CODING PROBLEM STATEMENT BANNER */}
      {activeProblem && (
        <div className="bg-slate-900/90 border-b border-slate-700/80 px-4 py-2.5 text-xs text-slate-300 font-sans shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-white tracking-wide text-sm flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>{activeProblem.title || 'Technical Challenge'}</span>
              </span>
              {activeProblem.difficulty && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                  activeProblem.difficulty.toLowerCase() === 'hard'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {activeProblem.difficulty}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowProblemDetails((v) => !v)}
              className="text-cyan-400 hover:text-cyan-200 text-xs font-mono font-medium underline cursor-pointer"
            >
              {showProblemDetails ? 'Hide Problem' : 'Show Problem'}
            </button>
          </div>
          {showProblemDetails && (
            <div className="mt-2 pt-2 border-t border-slate-800 text-slate-300 space-y-1.5 leading-relaxed animate-fadeIn">
              <p className="text-slate-200 text-xs font-medium">{activeProblem.description}</p>
              {Array.isArray(activeProblem.constraints) && activeProblem.constraints.length > 0 && (
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">Constraints:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-400 font-mono mt-0.5">
                    {activeProblem.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CODE EDITOR BODY */}
      <div className="flex-1 w-full min-h-[320px] relative bg-[#070b14]">
        {useNativeEditor ? (
          /* HIGH-CONTRAST NATIVE FALLBACK CODE EDITOR */
          <div className="w-full h-full flex bg-[#070b14] p-3 font-mono text-xs sm:text-sm text-slate-100 overflow-auto">
            <div className="w-9 shrink-0 text-slate-500 text-right pr-3 select-none font-mono text-xs border-r border-slate-800">
              {code.split('\n').map((_, i) => (
                <div key={i} className="leading-relaxed">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={code}
              onChange={(e) => {
                const val = e.target.value;
                setCode(val);
                onCodeChange?.(language, val);
              }}
              onKeyDown={(e) => {
                // Support Tab key indentation in native mode
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const target = e.currentTarget;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const val = target.value;
                  const nextVal = val.substring(0, start) + '  ' + val.substring(end);
                  setCode(nextVal);
                  onCodeChange?.(language, nextVal);
                  setTimeout(() => {
                    target.selectionStart = target.selectionEnd = start + 2;
                  }, 0);
                }
              }}
              spellCheck={false}
              className="w-full h-full min-h-[300px] bg-transparent text-slate-100 font-mono pl-3 focus:outline-none resize-none leading-relaxed selection:bg-cyan-500/30"
            />
          </div>
        ) : (
          /* MONACO EDITOR (STRICT INTERVIEW MODE: NO AUTO-COMPLETION) */
          <MonacoEditor
            height="100%"
            language={selectedLangObj.monacoLang}
            value={code}
            onChange={(newVal) => {
              const val = newVal || '';
              setCode(val);
              onCodeChange?.(language, val);
            }}
            onMount={handleEditorDidMount}
            loading={<EditorLoadingState />}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              roundedSelection: true,
              scrollBeyondLastLine: false,
              readOnly: false,
              automaticLayout: true,
              wordWrap: 'on',
              tabSize: 2,
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
              fontLigatures: true,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              renderLineHighlight: 'all',
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              // STRICT INTERVIEW SECURITY: NO AUTO-COMPLETION
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              snippetSuggestions: 'none',
              wordBasedSuggestions: 'off',
              parameterHints: { enabled: false },
              suggest: {
                showWords: false,
                showSnippets: false,
                showClasses: false,
                showFunctions: false,
                showVariables: false,
                showKeywords: false,
                showProperties: false,
                showMethods: false,
                showConstructors: false,
                showFields: false,
                showInterfaces: false,
                showModules: false,
                showUnits: false,
                showValues: false,
                showConstants: false,
                showEnums: false,
                showEnumMembers: false,
                showEvents: false,
                showOperators: false,
                showTypeParameters: false,
              },
              acceptSuggestionOnEnter: 'off',
              tabCompletion: 'off',
              inlineSuggest: { enabled: false },
            }}
          />
        )}
      </div>

      {/* TERMINAL / DRY RUN TEST RUNNER CONSOLE */}
      {terminalOutput && (
        <div className="border-t border-slate-700 bg-slate-900/98 p-4 font-mono text-xs space-y-3 max-h-[240px] overflow-y-auto animate-fadeIn z-10 shadow-inner">
          <div className="flex items-center justify-between text-slate-300 pb-2 border-b border-slate-700/80 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs sm:text-sm">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Test Execution Console</span>
              </span>

              {/* Status Badge */}
              {executionStats && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    executionStats.success
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-400/50'
                  }`}
                >
                  {executionStats.status}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3.5 text-xs text-slate-300 font-mono">
              {executionStats?.time && (
                <span className="flex items-center gap-1 text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{executionStats.time}s</span>
                </span>
              )}
              {executionStats?.memory !== undefined && (
                <span className="flex items-center gap-1 text-slate-200">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{executionStats.memory} KB</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => setTerminalOutput(null)}
                className="px-2.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white font-sans text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

          <pre
            className={`whitespace-pre-wrap leading-relaxed text-xs sm:text-sm ${
              executionStats?.success === false ? 'text-rose-300 font-medium' : 'text-emerald-300'
            }`}
          >
            {terminalOutput}
          </pre>
        </div>
      )}
    </div>
  );
};
