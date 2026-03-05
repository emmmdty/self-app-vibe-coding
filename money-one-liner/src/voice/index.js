function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read audio blob"));
    reader.readAsDataURL(blob);
  });
}

export function hasWebSpeechSupport() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createVoiceController({
  getVoiceMode,
  transcribeWithFallbackApi,
  onText,
  onStatus,
  onError
}) {
  let recognition = null;
  let mediaRecorder = null;
  let mediaStream = null;
  let chunks = [];
  let state = "idle";
  let allowWebSpeechFallback = true;

  const setState = (nextState) => {
    state = nextState;
    onStatus(nextState);
  };

  const stopStreamTracks = () => {
    if (!mediaStream) {
      return;
    }
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  };

  const stopSpeechRecognition = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // ignore stop errors
      }
      recognition = null;
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  };

  const startRecordingByApi = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error("当前浏览器不支持录音 API");
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
    chunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        if (!chunks.length) {
          throw new Error("未录制到语音，请重试");
        }
        setState("processing");
        const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || "audio/webm" });
        const audioBase64 = await blobToBase64(blob);
        const result = await transcribeWithFallbackApi({
          audioBase64,
          mimeType: blob.type || "audio/webm"
        });
        const text = String(result?.text ?? "").trim();
        if (!text) {
          throw new Error("语音转写为空，请重试");
        }
        onText(text);
      } catch (error) {
        onError(error);
      } finally {
        stopStreamTracks();
        chunks = [];
        mediaRecorder = null;
        setState("idle");
      }
    };

    mediaRecorder.start();
    setState("recording");
  };

  const startWebSpeech = () => {
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Constructor) {
      throw new Error("当前浏览器不支持 Web Speech");
    }

    recognition = new Constructor();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event?.results?.[0]?.[0]?.transcript?.trim();
      if (text) {
        onText(text);
      } else {
        onError(new Error("语音识别结果为空"));
      }
    };

    recognition.onerror = async (event) => {
      const message = event?.error ? `语音识别错误: ${event.error}` : "语音识别失败";
      stopSpeechRecognition();
      if (getVoiceMode() === "auto" && allowWebSpeechFallback) {
        allowWebSpeechFallback = false;
        try {
          await startRecordingByApi();
          return;
        } catch (fallbackError) {
          onError(fallbackError);
        }
      } else {
        onError(new Error(message));
      }
      setState("idle");
    };

    recognition.onend = () => {
      recognition = null;
      if (state !== "processing") {
        setState("idle");
      }
    };

    recognition.start();
    setState("listening");
  };

  const start = async () => {
    if (state !== "idle") {
      return;
    }

    allowWebSpeechFallback = true;
    const mode = getVoiceMode();
    try {
      if (mode === "webspeech") {
        startWebSpeech();
        return;
      }
      if (mode === "api") {
        await startRecordingByApi();
        return;
      }
      if (hasWebSpeechSupport()) {
        startWebSpeech();
        return;
      }
      await startRecordingByApi();
    } catch (error) {
      onError(error);
      setState("idle");
    }
  };

  const stop = () => {
    if (state === "listening") {
      stopSpeechRecognition();
      setState("idle");
      return;
    }
    if (state === "recording") {
      stopRecording();
    }
  };

  return {
    start,
    stop,
    toggle() {
      if (state === "idle") {
        void start();
      } else {
        stop();
      }
    },
    getState() {
      return state;
    }
  };
}
