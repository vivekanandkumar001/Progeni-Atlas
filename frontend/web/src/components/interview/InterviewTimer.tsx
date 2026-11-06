import { useEffect, useState } from "react"

interface TimerProps {
  sessionId: string
  onSectionChange?: (section: string, duration: number) => void
  defaultDuration?: number // in seconds, default 30 min = 1800
}

export function InterviewTimer({
  sessionId,
  onSectionChange,
  defaultDuration = 1800,
}: TimerProps) {
  const [elapsed, setElapsed] = useState(0)
  const [remaining, setRemaining] = useState(defaultDuration)
  const [percentage, setPercentage] = useState(0)
  const [currentSection, setCurrentSection] = useState<"intro" | "technical" | "coding" | "wrapup">(
    "intro"
  )
  const [sections, setSections] = useState<Record<"intro" | "technical" | "coding" | "wrapup", number>>({
    intro: 0,
    technical: 0,
    coding: 0,
    wrapup: 0,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(elapsed + 1000)
      setRemaining(defaultDuration - elapsed - 1000)
      setPercentage(Math.round(((elapsed + 1000) / defaultDuration) * 100))

      // Determine current section based on elapsed time
      if (elapsed < 200) setCurrentSection("intro")
      else if (elapsed < 1400) setCurrentSection("technical")
      else if (elapsed < defaultDuration - 200) setCurrentSection("coding")
      else setCurrentSection("wrapup")
    }, 1000)

    return () => clearInterval(interval)
  }, [elapsed, defaultDuration])

  // Sync section times with backend periodically
  useEffect(() => {
    if (!sessionId) return

    const fetchSectionTimes = async () => {
      try {
        const resp = await fetch(
          `/api/timer/status?sessionId=${sessionId}`
        )
        if (resp.ok) {
          const data = await resp.json()
          if (data.data && data.data.sections) {
            setSections(data.data.sections)
          }
          if (data.data && data.data.current_section) {
            setCurrentSection(data.data.current_section)
          }
        }
      } catch (err) {
        console.error("Failed to fetch timer status:", err)
      }
    }

    // Initial fetch
    fetchSectionTimes()

    // Poll every 5 seconds
    const interval = setInterval(fetchSectionTimes, 5000)
    return () => clearInterval(interval)
  }, [sessionId, defaultDuration])

  // Track section change and record to backend
  useEffect(() => {
    if (!sessionId) return

    const recordSection = async () => {
      try {
        await fetch("/api/timer/record", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            section: currentSection,
            duration: Math.round(elapsed / 1000), // convert ms to seconds
          }),
        })
      } catch (err) {
        console.error("Failed to record section time:", err)
      }
    }

    // Record when section changes
    recordSection()

    // Also record periodically
    const interval = setInterval(recordSection, 15000)
    return () => clearInterval(interval)
  }, [sessionId, currentSection, elapsed])

  // Format time into mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  // Color code based on current section and time
  const sectionColor = {
    intro: "#10b981", // green
    technical: "#f59e0b", // amber
    coding: "#3b82f6", // blue
    wrapup: "#8b5cf6", // violet
  }[currentSection]

  return (
    <div className="interview-timer-container">
      <div className="timer-display">
        <div>{formatTime(remaining)}</div>
        <small>{percentage}% complete</small>
      </div>

      <div className="section-progress">
        <span>{currentSection.toUpperCase()}</span>
        <span>{Math.round(sections[currentSection])}s</span>
      </div>

      <div className="progress-bar">
        <div
          style={{
            width: `${percentage}%`,
            backgroundColor: sectionColor,
          }}
        ></div>
      </div>
    </div>
  )
}