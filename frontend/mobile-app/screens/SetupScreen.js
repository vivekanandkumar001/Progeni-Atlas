import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { startSession } from "../api";

export default function SetupScreen({ onStarted }) {
  const [resumeFile, setResumeFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);

  const pickResume = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (result.assets && result.assets.length) setResumeFile(result.assets[0]);
  };

  const handleStart = async () => {
    if (!resumeFile) {
      Alert.alert("Resume required", "Please upload your resume (PDF) first.");
      return;
    }
    setLoading(true);
    try {
      const data = await startSession(resumeFile, jdText);
      if (data.error) throw new Error(data.error);
      onStarted(data);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧠 Swami AI</Text>
      <Text style={styles.subtitle}>Interviewer Agent</Text>

      <Text style={styles.label}>Resume</Text>
      <Button title={resumeFile ? resumeFile.name : "Upload Resume (PDF)"} onPress={pickResume} />

      <Text style={styles.label}>Job Description</Text>
      <TextInput
        style={styles.textarea}
        multiline
        numberOfLines={6}
        placeholder="Paste the JD here..."
        placeholderTextColor="#666"
        value={jdText}
        onChangeText={setJdText}
      />

      {loading ? (
        <ActivityIndicator color="#7c9cff" style={{ marginTop: 20 }} />
      ) : (
        <Button title="Generate Questions & Start" onPress={handleStart} color="#7c9cff" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1117", padding: 24, paddingTop: 60 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#7c9cff", fontSize: 14, marginBottom: 24 },
  label: { color: "#a0a6b8", fontSize: 13, marginTop: 18, marginBottom: 6 },
  textarea: {
    backgroundColor: "#171a23", borderWidth: 1, borderColor: "#2c3140", borderRadius: 8,
    color: "#e6e6e6", padding: 10, minHeight: 100, textAlignVertical: "top",
  },
});
