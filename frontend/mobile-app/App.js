import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import SetupScreen from "./screens/SetupScreen";
import InterviewScreen from "./screens/InterviewScreen";
import ReportScreen from "./screens/ReportScreen";

// Same 3-step flow as the website: setup -> interview -> report
export default function App() {
  const [screen, setScreen] = useState("setup");
  const [sessionData, setSessionData] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  return (
    <>
      <StatusBar style="light" />
      {screen === "setup" && (
        <SetupScreen
          onStarted={(data) => {
            setSessionData(data);
            setScreen("interview");
          }}
        />
      )}
      {screen === "interview" && (
        <InterviewScreen
          sessionData={sessionData}
          onFinished={(sid) => {
            setSessionId(sid);
            setScreen("report");
          }}
        />
      )}
      {screen === "report" && <ReportScreen sessionId={sessionId} />}
    </>
  );
}
