'use client';

import React, { useState } from 'react';
import { Play, Code2, Terminal, CheckCircle2, RefreshCw, Copy } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const LANGUAGE_TEMPLATES: Record<string, string> = {
  python: `class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_sec: int):
        self.limit = limit
        self.window_sec = window_sec
        # Store timestamp logs per user key
        self.user_requests = {}

    def allow_request(self, user_id: str, current_time: float) -> bool:
        # Implement sliding window algorithm
        if user_id not in self.user_requests:
            self.user_requests[user_id] = []
        
        # Filter out expired timestamps
        cutoff = current_time - self.window_sec
        self.user_requests[user_id] = [t for t in self.user_requests[user_id] if t > cutoff]
        
        if len(self.user_requests[user_id]) < self.limit:
            self.user_requests[user_id].append(current_time)
            return True
        return False

# Quick verification test case
limiter = SlidingWindowRateLimiter(limit=5, window_sec=60)
print("Request 1:", limiter.allow_request("user_101", 100.0))
`,
  typescript: `export class SlidingWindowRateLimiter {
  private limit: number;
  private windowSec: number;
  private userLogs: Map<string, number[]>;

  constructor(limit: number, windowSec: number) {
    this.limit = limit;
    this.windowSec = windowSec;
    this.userLogs = new Map();
  }

  public allowRequest(userId: string, currentTime: number): boolean {
    const logs = this.userLogs.get(userId) || [];
    const cutoff = currentTime - this.windowSec;
    const validLogs = logs.filter(t => t > cutoff);

    if (validLogs.length < this.limit) {
      validLogs.push(currentTime);
      this.userLogs.set(userId, validLogs);
      return true;
    }
    return false;
  }
}
`,
  javascript: `function checkRateLimit(userId, timestampLog, limit, windowSec) {
  const cutoff = Date.now() - (windowSec * 1000);
  const activeRequests = timestampLog.filter(ts => ts > cutoff);
  return activeRequests.length < limit;
}
`,
  java: `import java.util.*;

public class RateLimiter {
    private final int limit;
    private final long windowMillis;

    public RateLimiter(int limit, long windowSeconds) {
        this.limit = limit;
        this.windowMillis = windowSeconds * 1000;
    }

    public boolean allowRequest(String userId) {
        return true;
    }
}
`,
  cpp: `#include <iostream>
#include <unordered_map>
#include <vector>

class RateLimiter {
public:
    RateLimiter(int limit, int windowSec) : limit(limit), windowSec(windowSec) {}
    bool allowRequest(std::string userId) {
        return true;
    }
private:
    int limit;
    int windowSec;
};
`,
  sql: `-- High-throughput rate limiter evaluation logs query
SELECT 
    user_id, 
    COUNT(id) AS request_count,
    MAX(created_at) AS last_request_time
FROM rate_limit_logs
WHERE created_at >= NOW() - INTERVAL '1 minute'
GROUP BY user_id
HAVING COUNT(id) > 100;
`
};

interface CodeWorkspaceProps {
  sessionId: string;
}

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ sessionId }) => {
  const [language, setLanguage] = useState<string>('python');
  const [code, setCode] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminalOutput, setTerminalOutput] = useState<string | null>(null);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setTerminalOutput(null);
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setTerminalOutput(null);
    try {
      const res = await apiFetch(`/api/v1/interview-sessions/${sessionId}/code-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });

      if (!res) {
        setTerminalOutput('Failed to connect to backend API server.');
        return;
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        setTerminalOutput('Invalid response from code runner.');
        return;
      }

      if (data.configured === false || data.status === 'Code runner not configured') {
        setTerminalOutput('Code runner not configured');
        return;
      }

      if (data.error) {
        setTerminalOutput(`⚡ Error: ${data.error}`);
        return;
      }

      let output = '';
      if (data.stdout) output += data.stdout;
      if (data.stderr) {
        if (output) output += '\n--- Stderr / Compilation ---\n';
        output += data.stderr;
      }

      if (!output.trim()) {
        output = `[Execution finished with no output. Status: ${data.status || 'Done'}]`;
      }

      if (data.time) {
        output += `\n\n[Execution Time: ${data.time}s | Status: ${data.status || 'OK'}]`;
      }

      setTerminalOutput(output);
    } catch (e: any) {
      setTerminalOutput(`Execution error: ${e?.message || 'Could not execute code'}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-inset rounded-2xl border border-line overflow-hidden shadow-2xl">
      
      {/* EDITOR TOOLBAR */}
      <div className="p-3 bg-surface border-b border-line flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-accent-cyan">
            <Code2 className="w-4 h-4" />
            <span>Interactive Code Sandbox</span>
          </div>

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-3 py-1 rounded-lg bg-inset border border-line text-ink text-xs font-mono cursor-pointer focus:outline-none focus:border-cyan-500"
          >
            <option value="python">Python 3.11</option>
            <option value="typescript">TypeScript 5.0</option>
            <option value="javascript">JavaScript ESNext</option>
            <option value="java">Java 21</option>
            <option value="cpp">C++ 20</option>
            <option value="sql">SQL Query</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleRunCode}
          disabled={isRunning}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isRunning ? 'Executing Code...' : 'Run Sandbox Code'}</span>
        </button>
      </div>

      {/* CODE TEXTAREA EDITOR */}
      <div className="flex-1 relative bg-inset p-4 font-mono text-xs sm:text-sm text-ink overflow-auto">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="w-full h-full min-h-[300px] bg-transparent text-ink font-mono focus:outline-none resize-none leading-relaxed"
        />
      </div>

      {/* TERMINAL OUTPUT DRAWER */}
      {terminalOutput && (
        <div className="border-t border-line bg-surface p-4 font-mono text-xs space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-ink-muted pb-1 border-b border-line">
            <span className="flex items-center gap-1.5 text-accent-cyan font-bold">
              <Terminal className="w-3.5 h-3.5" />
              <span>Sandbox Execution Console</span>
            </span>
            <button
              type="button"
              onClick={() => setTerminalOutput(null)}
              className="text-ink-muted hover:text-ink cursor-pointer"
            >
              Close
            </button>
          </div>
          <pre className="text-accent-emerald whitespace-pre-wrap leading-relaxed">
            {terminalOutput}
          </pre>
        </div>
      )}

    </div>
  );
};
