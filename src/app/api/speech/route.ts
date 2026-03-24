import type {
  PronunciationAssessmentResponse,
  PronunciationWordResult,
  SpeechProxyStatus
} from "@/lib/speech/types";

export const runtime = "edge";

interface AzurePronunciationWord {
  Word?: string;
  AccuracyScore?: number;
  ErrorType?: string;
  Confidence?: number;
}

interface AzurePronunciationResult {
  Display?: string;
  Confidence?: number;
  AccuracyScore?: number;
  FluencyScore?: number;
  CompletenessScore?: number;
  PronScore?: number;
  ProsodyScore?: number;
  Words?: AzurePronunciationWord[];
}

interface AzureRecognitionResponse {
  RecognitionStatus?: string;
  DisplayText?: string;
  Offset?: number | string;
  Duration?: number | string;
  NBest?: AzurePronunciationResult[];
}

function getConfigState() {
  return {
    configured: Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
    region: process.env.AZURE_SPEECH_REGION ?? null
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status
  });
}

function toBase64Json(value: Record<string, string | boolean>) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function mapWords(words: AzurePronunciationWord[] | undefined): PronunciationWordResult[] {
  if (!words) {
    return [];
  }

  return words.map((word) => ({
    word: word.Word ?? "",
    accuracyScore: toNullableNumber(word.AccuracyScore),
    errorType: word.ErrorType ?? null,
    confidence: toNullableNumber(word.Confidence)
  }));
}

function buildSuccessResponse(
  payload: AzureRecognitionResponse,
  locale: string,
  referenceText: string
): PronunciationAssessmentResponse {
  const best = payload.NBest?.[0];

  return {
    ok: true,
    runtime,
    ...getConfigState(),
    locale,
    referenceText,
    recognizedText: best?.Display ?? payload.DisplayText ?? "",
    recognitionStatus: payload.RecognitionStatus ?? "Unknown",
    duration: toNullableNumber(payload.Duration),
    offset: toNullableNumber(payload.Offset),
    scores: {
      accuracy: toNullableNumber(best?.AccuracyScore),
      fluency: toNullableNumber(best?.FluencyScore),
      completeness: toNullableNumber(best?.CompletenessScore),
      pronunciation: toNullableNumber(best?.PronScore),
      prosody: toNullableNumber(best?.ProsodyScore),
      confidence: toNullableNumber(best?.Confidence)
    },
    words: mapWords(best?.Words)
  };
}

export async function GET() {
  const body: SpeechProxyStatus = {
    ok: true,
    runtime,
    ...getConfigState(),
    message:
      "Speech proxy is reserved for Azure pronunciation assessment. Keys stay on the Edge function only."
  };

  return jsonResponse(body);
}

export async function POST(request: Request) {
  const config = getConfigState();

  if (!config.configured || !process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    return jsonResponse(
      {
        ok: false,
        runtime,
        ...config,
        message: "Azure Speech is not configured on this deployment."
      },
      503
    );
  }

  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const referenceText = formData.get("referenceText");
    const localeValue = formData.get("locale");
    const locale = typeof localeValue === "string" && localeValue ? localeValue : "ja-JP";

    if (!(audio instanceof File)) {
      return jsonResponse(
        {
          ok: false,
          runtime,
          ...config,
          message: "Audio file is required."
        },
        400
      );
    }

    if (typeof referenceText !== "string" || !referenceText.trim()) {
      return jsonResponse(
        {
          ok: false,
          runtime,
          ...config,
          message: "Reference text is required for pronunciation assessment."
        },
        400
      );
    }

    const endpoint = new URL(
      `https://${process.env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`
    );
    endpoint.searchParams.set("language", locale);
    endpoint.searchParams.set("format", "detailed");

    const pronunciationHeader = toBase64Json({
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Word",
      Dimension: "Comprehensive",
      EnableMiscue: true
    });

    const azureResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
        "Pronunciation-Assessment": pronunciationHeader
      },
      body: await audio.arrayBuffer()
    });

    const responseText = await azureResponse.text();

    if (!azureResponse.ok) {
      return jsonResponse(
        {
          ok: false,
          runtime,
          ...config,
          message: `Azure Speech request failed with ${azureResponse.status}: ${responseText || azureResponse.statusText}`
        },
        azureResponse.status
      );
    }

    const payload = JSON.parse(responseText) as AzureRecognitionResponse;
    return jsonResponse(buildSuccessResponse(payload, locale, referenceText));
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        runtime,
        ...config,
        message: error instanceof Error ? error.message : "Speech proxy failed unexpectedly."
      },
      500
    );
  }
}
