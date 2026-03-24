import type {
  PronunciationAssessmentResponse,
  SpeechProxyStatus
} from "@/lib/speech/types";

export async function fetchSpeechProxyStatus(): Promise<SpeechProxyStatus> {
  const response = await fetch("/api/speech", {
    cache: "no-store"
  });
  const data = (await response.json()) as SpeechProxyStatus;

  if (!response.ok) {
    throw new Error(data.message || "Unable to read speech proxy status.");
  }

  return data;
}

interface AssessPronunciationInput {
  audio: Blob;
  referenceText: string;
  locale?: string;
}

export async function assessPronunciation({
  audio,
  referenceText,
  locale = "ja-JP"
}: AssessPronunciationInput): Promise<PronunciationAssessmentResponse> {
  const formData = new FormData();
  formData.append("audio", audio, "utterance.wav");
  formData.append("referenceText", referenceText);
  formData.append("locale", locale);

  const response = await fetch("/api/speech", {
    method: "POST",
    body: formData
  });
  const data = (await response.json()) as PronunciationAssessmentResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Pronunciation assessment failed.");
  }

  return data;
}
