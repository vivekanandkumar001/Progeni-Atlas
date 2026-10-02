import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { getFeedback } from "../api";

export default function ReportScreen({ sessionId }) {
  const [report, setReport] = useState(null);

  useEffect(() => {
    getFeedback(sessionId).then(setReport);
  }, [sessionId]);

  if (!report) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c9cff" />
        <Text style={styles.dim}>Generating report…</Text>
      </View>
    );
  }

  const cats = report.category_scores || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 50 }}>
      <Text style={styles.title}>📋 Feedback Report</Text>
      <Text style={styles.score}>{report.overall_score}/100</Text>
      <Text style={styles.verdict}>{report.verdict}</Text>
      <Text style={styles.summary}>{report.summary}</Text>

      <Text style={styles.section}>Category Scores</Text>
      {Object.entries(cats).map(([k, v]) => (
        <View key={k} style={styles.row}>
          <Text style={styles.rowLabel}>{k.replace(/_/g, " ")}</Text>
          <Text style={styles.rowValue}>{v}/10</Text>
        </View>
      ))}

      <Text style={styles.section}>Strengths</Text>
      {(report.strengths || []).map((s, i) => <Text key={i} style={styles.item}>✅ {s}</Text>)}

      <Text style={styles.section}>Improvements</Text>
      {(report.improvements || []).map((s, i) => <Text key={i} style={styles.item}>⚠️ {s}</Text>)}

      <Text style={styles.section}>Per-Question Breakdown</Text>
      {(report.per_question || []).map((a, i) => (
        <View key={i} style={styles.qaItem}>
          <Text style={styles.qaQ}>Q{i + 1} [{a.type}]: {a.question}</Text>
          <Text style={styles.qaA}>Answer: {a.transcript}</Text>
          <Text style={styles.qaS}>Score: {a.score}/10 — {a.comment}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1117" },
  center: { flex: 1, backgroundColor: "#0f1117", justifyContent: "center", alignItems: "center" },
  dim: { color: "#a0a6b8", marginTop: 10 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 10 },
  score: { color: "#7c9cff", fontSize: 32, fontWeight: "700" },
  verdict: { color: "#e6e6e6", fontSize: 15, marginTop: 4, marginBottom: 10 },
  summary: { color: "#a0a6b8", fontSize: 13, lineHeight: 19, marginBottom: 10 },
  section: { color: "#7c9cff", fontSize: 14, fontWeight: "700", marginTop: 18, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#232733", paddingVertical: 6 },
  rowLabel: { color: "#e6e6e6" },
  rowValue: { color: "#a0a6b8" },
  item: { color: "#e6e6e6", paddingVertical: 3, fontSize: 13 },
  qaItem: { borderTopWidth: 1, borderTopColor: "#232733", paddingVertical: 10 },
  qaQ: { color: "#e6e6e6", fontWeight: "600", fontSize: 13 },
  qaA: { color: "#a0a6b8", fontSize: 12, marginTop: 3, fontStyle: "italic" },
  qaS: { color: "#7c9cff", fontSize: 12, marginTop: 3 },
});
