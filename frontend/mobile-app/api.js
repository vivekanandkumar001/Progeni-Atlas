// ---------------------------------------------------------------
// Same Flask backend, same /api/* routes used by the website.
// Change this to your deployed server URL before building for a client.
// While testing on a physical device, "localhost" won't work — use your
// machine's LAN IP, e.g. "http://192.168.1.5:5000"
// ---------------------------------------------------------------
export const API_BASE_URL = "http://localhost:5000";

export async function startSession(resumeFile, jdText) {
  const form = new FormData();
  form.append("resume", {
    uri: resumeFile.uri,
    name: resumeFile.name,
    type: resumeFile.mimeType || "application/pdf",
  });
  form.append("jd_text", jdText);

  const res = await fetch(`${API_BASE_URL}/api/start_session`, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.json();
}

export async function submitAnswer(sessionId, audioUri) {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("audio", {
    uri: audioUri,
    name: "answer.m4a",
    type: "audio/m4a",
  });

  const res = await fetch(`${API_BASE_URL}/api/submit_answer`, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.json();
}

export async function getFeedback(sessionId) {
  const res = await fetch(`${API_BASE_URL}/api/feedback?session_id=${sessionId}`);
  return res.json();
}
