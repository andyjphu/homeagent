/**
 * Deepgram Nova-3 transcription client.
 *
 * Sends a recording URL to Deepgram's /v1/listen endpoint.
 * Deepgram fetches the audio directly — no need to download first.
 * Returns transcript text with speaker diarization segments.
 */

export interface SpeakerSegment {
  speaker: number;
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  transcript: string;
  speakers: SpeakerSegment[];
  duration_seconds: number;
}

function getApiKey(): string | null {
  return process.env.DEEPGRAM_API_KEY || null;
}

/**
 * Transcribe a recording via Deepgram Nova-3.
 * Pass the public URL of the audio file — Deepgram fetches it directly.
 * Returns null if DEEPGRAM_API_KEY is not set.
 */
export async function transcribeRecording(
  audioUrl: string
): Promise<TranscriptionResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[deepgram] No DEEPGRAM_API_KEY configured — skipping transcription");
    return null;
  }

  const params = new URLSearchParams({
    model: "nova-3",
    language: "en",
    smart_format: "true",
    diarize: "true",
    keywords: "MLS:2,listing:2,contingency:2,escrow:2,appraisal:2,pre-approval:2",
  });

  const url = `https://api.deepgram.com/v1/listen?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioUrl }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[deepgram] API error ${res.status}: ${errText}`);
      return null;
    }

    const data = await res.json();

    // Extract main transcript
    const transcript: string =
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    // Extract speaker-diarized segments
    const words: Array<{
      word: string;
      start: number;
      end: number;
      speaker?: number;
    }> = data.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];

    const speakers = buildSpeakerSegments(words);

    // Duration from metadata
    const duration_seconds: number =
      data.metadata?.duration ?? 0;

    return { transcript, speakers, duration_seconds };
  } catch (err) {
    console.error("[deepgram] Transcription failed:", err);
    return null;
  }
}

/**
 * Group word-level results into contiguous speaker segments.
 */
function buildSpeakerSegments(
  words: Array<{ word: string; start: number; end: number; speaker?: number }>
): SpeakerSegment[] {
  if (words.length === 0) return [];

  const segments: SpeakerSegment[] = [];
  let currentSpeaker = words[0].speaker ?? 0;
  let currentStart = words[0].start;
  let currentWords: string[] = [words[0].word];

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const speaker = w.speaker ?? 0;

    if (speaker !== currentSpeaker) {
      segments.push({
        speaker: currentSpeaker,
        text: currentWords.join(" "),
        start: currentStart,
        end: words[i - 1].end,
      });
      currentSpeaker = speaker;
      currentStart = w.start;
      currentWords = [w.word];
    } else {
      currentWords.push(w.word);
    }
  }

  // Push last segment
  segments.push({
    speaker: currentSpeaker,
    text: currentWords.join(" "),
    start: currentStart,
    end: words[words.length - 1].end,
  });

  return segments;
}
