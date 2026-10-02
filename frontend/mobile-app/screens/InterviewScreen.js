import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Audio } from "expo-av";
import { submitAnswer } from "../api";

export default function InterviewScreen({ sessionData, onFinished }) {
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [question, setQuestion] = useState(sessionData.first_question);
  const [progress, setProgress] = useState({ current: 1, total: sessionData.total_questions });
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestCamPerm();
    requestMicPerm();
    Audio.requestPermissionsAsync();
  }, []);

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setFeedbackText("");
    } catch (err) {
      setFeedbackText("Mic error: " + err.message);
    }
  };

  const stopAndSubmit = async () => {
    if (!recording) return;
    setIsRecording(false);
    setBusy(true);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    try {
      const data = await submitAnswer(sessionData.session_id, uri);
      if (data.error) throw new Error(data.error);
      setFeedbackText(`Score: ${data.score}/10 — ${data.comment}`);

      if (data.done) {
        setTimeout(() => onFinished(sessionData.session_id), 1200);
      } else {
        setTimeout(() => {
          setQuestion(data.next_question);
          setProgress(data.progress);
          setFeedbackText("");
        }, 1500);
      }
    } catch (err) {
      setFeedbackText("Error: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!camPerm || !camPerm.granted || !micPerm || !micPerm.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>Camera & microphone permission needed to continue.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="front" />
      <ScrollView style={styles.qaPane}>
        <Text style={styles.progress}>Q{progress.current} / {progress.total}</Text>
        <View style={styles.questionBox}>
          <Text style={styles.questionType}>{(question?.type || "question").toUpperCase()}</Text>
          <Text style={styles.questionText}>{question?.text}</Text>
        </View>

        {!isRecording ? (
          <TouchableOpacity style={[styles.btn, styles.btnRecord]} onPress={startRecording} disabled={busy}>
            <Text style={styles.btnText}>🎙️ Start Answer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnStop]} onPress={stopAndSubmit}>
            <Text style={styles.btnText}>⏹ Stop & Submit</Text>
          </TouchableOpacity>
        )}

        {!!feedbackText && <Text style={styles.feedback}>{feedbackText}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1117" },
  camera: { height: 260, width: "100%" },
  qaPane: { flex: 1, padding: 18 },
  progress: { color: "#7c9cff", fontSize: 13, marginBottom: 8 },
  questionBox: { backgroundColor: "#171a23", borderRadius: 12, padding: 18, borderWidth: 1, borderColor: "#232733" },
  questionType: { color: "#7c9cff", fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  questionText: { color: "#e6e6e6", fontSize: 16, lineHeight: 22 },
  btn: { marginTop: 18, padding: 14, borderRadius: 8, alignItems: "center" },
  btnRecord: { backgroundColor: "#2e7d32" },
  btnStop: { backgroundColor: "#c62828" },
  btnText: { color: "#fff", fontWeight: "700" },
  feedback: { color: "#a0a6b8", marginTop: 14, fontSize: 13 },
  center: { flex: 1, backgroundColor: "#0f1117", justifyContent: "center", alignItems: "center", padding: 24 },
  dim: { color: "#a0a6b8", textAlign: "center" },
});
