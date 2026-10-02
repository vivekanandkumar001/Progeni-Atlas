// ---------------------------------------------------------------
// Swami AI — frontend interview flow controller
// ---------------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/static/service-worker.js").catch(() => {});
  });
}

let sessionId = null;
let mediaStream = null;
let audioRecorder = null;
let audioChunks = [];
let videoRecorder = null;
let videoChunkIndex = 0;

const screens = {
  setup: document.getElementById("screen-setup"),
  interview: document.getElementById("screen-interview"),
  report: document.getElementById("screen-report"),
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ---------- Step 1: setup -> start session ----------
document.getElementById("btnGenerate").addEventListener("click", async () => {
  const fileInput = document.getElementById("resumeFile");
  const jdText = document.getElementById("jdText").value.trim();
  const status = document.getElementById("setupStatus");

  if (!fileInput.files.length) {
    status.textContent = "Please upload a resume first.";
    return;
  }
  status.textContent = "Reading resume & generating personalized questions…";

  const form = new FormData();
  form.append("resume", fileInput.files[0]);
  form.append("jd_text", jdText);

  try {
    const res = await fetch("/api/start_session", { method: "POST", body: form });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    sessionId = data.session_id;
    await initMedia();
    renderQuestion(data.first_question, { current: 1, total: data.total_questions });
    showScreen("interview");
  } catch (err) {
    status.textContent = "Error: " + err.message;
  }
});

// ---------- webcam + mic init ----------
async function initMedia() {
  mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const previewEl = document.getElementById("webcamPreview");
  previewEl.srcObject = mediaStream;

  // full-session video recorder (chunked upload every ~10s for durability)
  videoRecorder = new MediaRecorder(mediaStream, { mimeType: "video/webm;codecs=vp8,opus" });
  videoRecorder.ondataavailable = async (e) => {
    if (e.data && e.data.size > 0) {
      const form = new FormData();
      form.append("session_id", sessionId);
      form.append("chunk_index", videoChunkIndex++);
      form.append("chunk", e.data, `video_${videoChunkIndex}.webm`);
      fetch("/api/save_video_chunk", { method: "POST", body: form });
    }
  };
  videoRecorder.start(10000); // emit a chunk every 10s
  document.getElementById("recDot").classList.add("live");
}

// ---------- question rendering ----------
function renderQuestion(q, progress) {
  document.getElementById("questionType").textContent = q.type || "question";
  document.getElementById("questionText").textContent = q.text;
  document.getElementById("progressText").textContent = `Q${progress.current} / ${progress.total}`;
  document.getElementById("answerFeedback").textContent = "";
  document.getElementById("btnRecord").disabled = false;
  document.getElementById("btnStop").disabled = true;
}

// ---------- per-answer audio recording ----------
document.getElementById("btnRecord").addEventListener("click", () => {
  audioChunks = [];
  const audioOnlyStream = new MediaStream(mediaStream.getAudioTracks());
  audioRecorder = new MediaRecorder(audioOnlyStream, { mimeType: "audio/webm" });
  audioRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  audioRecorder.start();

  document.getElementById("btnRecord").disabled = true;
  document.getElementById("btnStop").disabled = false;
});

document.getElementById("btnStop").addEventListener("click", () => {
  audioRecorder.stop();
  document.getElementById("btnStop").disabled = true;
  audioRecorder.onstop = submitAnswer;
});

async function submitAnswer() {
  const status = document.getElementById("answerFeedback");
  status.textContent = "Transcribing & evaluating your answer…";

  const blob = new Blob(audioChunks, { type: "audio/webm" });
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("audio", blob, "answer.webm");

  try {
    const res = await fetch("/api/submit_answer", { method: "POST", body: form });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    status.innerHTML = `<b>Transcript:</b> ${data.transcript}<br>` +
      `<b>Score:</b> ${data.score}/10 — ${data.comment}`;

    if (data.done) {
      finishInterview();
    } else {
      setTimeout(() => renderQuestion(data.next_question, data.progress), 1500);
    }
  } catch (err) {
    status.textContent = "Error: " + err.message;
    document.getElementById("btnRecord").disabled = false;
  }
}

// ---------- wrap up ----------
async function finishInterview() {
  if (videoRecorder && videoRecorder.state !== "inactive") videoRecorder.stop();
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  document.getElementById("recDot").classList.remove("live");

  showScreen("report");
  const res = await fetch(`/api/feedback?session_id=${sessionId}`);
  const report = await res.json();
  renderReport(report);
}

function renderReport(r) {
  const el = document.getElementById("reportBody");
  const cats = r.category_scores || {};
  el.innerHTML = `
    <div class="score-badge">${r.overall_score}/100</div>
    <p><b>Verdict:</b> ${r.verdict}</p>
    <p>${r.summary}</p>

    <h3>Category Scores</h3>
    ${Object.entries(cats).map(([k, v]) => `<div class="cat-row"><span>${k.replace(/_/g, " ")}</span><span>${v}/10</span></div>`).join("")}

    <h3>Strengths</h3>
    <ul class="tag-list">${(r.strengths || []).map(s => `<li>✅ ${s}</li>`).join("")}</ul>

    <h3>Areas to Improve</h3>
    <ul class="tag-list">${(r.improvements || []).map(s => `<li>⚠️ ${s}</li>`).join("")}</ul>

    <h3>Per-Question Breakdown</h3>
    ${(r.per_question || []).map((a, i) => `
      <div class="qa-item">
        <b>Q${i + 1} [${a.type}]:</b> ${a.question}<br>
        <i>Answer:</i> ${a.transcript}<br>
        <i>Score:</i> ${a.score}/10 — ${a.comment}
      </div>`).join("")}
  `;
}
