export interface SpeechProxyStatus {
  ok: boolean;
  runtime: "edge";
  configured: boolean;
  region: string | null;
  message: string;
}

export interface PronunciationWordResult {
  word: string;
  accuracyScore: number | null;
  errorType: string | null;
  confidence: number | null;
}

export interface PronunciationAssessmentScores {
  accuracy: number | null;
  fluency: number | null;
  completeness: number | null;
  pronunciation: number | null;
  prosody: number | null;
  confidence: number | null;
}

export interface PronunciationAssessmentResponse {
  ok: boolean;
  runtime: "edge";
  configured: boolean;
  region: string | null;
  locale: string;
  referenceText: string;
  recognizedText: string;
  recognitionStatus: string;
  duration: number | null;
  offset: number | null;
  scores: PronunciationAssessmentScores;
  words: PronunciationWordResult[];
  message?: string;
}
