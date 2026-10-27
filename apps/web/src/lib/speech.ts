type Rec = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function speak(text: string, pitch: number, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!canSpeak()) {
      reject(new Error("no-engine"));
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    window.setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.pitch = Math.min(2, Math.max(0.5, pitch));
      utter.rate = Math.min(1.4, Math.max(0.7, rate));
      utter.onend = () => resolve();
      utter.onerror = () => reject(new Error("speech-failed"));
      synth.resume();
      synth.speak(utter);
    }, 60);
  });
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function startRecognition(handlers: {
  onText: (text: string) => void;
  onError: () => void;
  onEnd: () => void;
}): { stop: () => void } | null {
  const host = window as unknown as {
    SpeechRecognition?: new () => Rec;
    webkitSpeechRecognition?: new () => Rec;
  };
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.onresult = (event) => {
    let text = "";
    for (let index = 0; index < event.results.length; index += 1) {
      text += `${event.results[index][0]?.transcript ?? ""} `;
    }
    handlers.onText(text.trim());
  };
  rec.onerror = () => handlers.onError();
  rec.onend = () => handlers.onEnd();
  rec.start();
  return { stop: () => rec.stop() };
}
