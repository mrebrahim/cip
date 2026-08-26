import { AppError } from "./errors";

const MODEL = "gemini-2.5-flash";
const BASE = "https://generativelanguage.googleapis.com";

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AppError("invalid_key", "GEMINI_API_KEY is not set");
  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A request is capped at 20MB, and a two-hour recording is far past that, so
 * media goes through the Files API and is referenced by URI. Google keeps an
 * uploaded file available for 48 hours, which comfortably outlasts a run.
 */
export async function uploadFile(
  bytes: ArrayBuffer,
  mimeType: string,
  displayName: string,
): Promise<string> {
  const start = await fetch(`${BASE}/upload/v1beta/files?key=${apiKey()}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });

  if (!start.ok) {
    throw new AppError("unknown", `files api start ${start.status}: ${await start.text()}`);
  }

  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new AppError("unknown", "files api returned no upload url");

  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });

  if (!upload.ok) {
    throw new AppError("unknown", `files api upload ${upload.status}: ${await upload.text()}`);
  }

  const result = (await upload.json()) as {
    file?: { name: string; uri: string; state: string };
  };
  if (!result.file?.uri) throw new AppError("unknown", "files api returned no uri");

  await waitUntilActive(result.file.name, result.file.state);
  return result.file.uri;
}

/** A freshly uploaded file is PROCESSING for a while; sending it early fails. */
async function waitUntilActive(name: string, initialState: string) {
  let state = initialState;
  for (let attempt = 0; attempt < 60 && state === "PROCESSING"; attempt++) {
    await sleep(2000);
    const res = await fetch(`${BASE}/v1beta/${name}?key=${apiKey()}`);
    if (!res.ok) break;
    state = ((await res.json()) as { state: string }).state;
  }
  if (state === "FAILED") throw new AppError("unknown", `file processing failed: ${name}`);
}

type Part =
  | { text: string }
  | { file_data: { mime_type: string; file_uri: string } };

/**
 * Transient 429/503 from the model are common on long jobs and cost a whole
 * stage if they escape, so they are retried with backoff before giving up.
 */
async function generate(
  parts: Part[],
  opts: { maxOutputTokens: number; thinkingBudget: number },
): Promise<string> {
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: opts.maxOutputTokens,
      thinkingConfig: { thinkingBudget: opts.thinkingBudget },
    },
  });

  let lastDetail = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(2000 * 2 ** (attempt - 1));

    const res = await fetch(
      `${BASE}/v1beta/models/${MODEL}:generateContent?key=${apiKey()}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
    );

    if (res.status === 429 || res.status >= 500) {
      lastDetail = `${res.status}: ${await res.text()}`;
      continue;
    }
    if (!res.ok) throw new AppError("unknown", `gemini ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string }[] };
      }[];
    };
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();

    if (text) {
      // A response cut off at the output ceiling still looks like a perfectly
      // good string. Silently storing a half-transcribed two-hour lecture is
      // far worse than failing, because the document built on top of it would
      // look finished and simply be missing the second half.
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new AppError("output_truncated", `hit maxOutputTokens (${opts.maxOutputTokens})`);
      }
      return text;
    }
    lastDetail = `model returned no text (finishReason: ${candidate?.finishReason ?? "none"})`;
  }

  throw new AppError("unknown", `gemini gave up after retries — ${lastDetail}`);
}

export async function transcribeAudio(fileUri: string, mimeType: string) {
  const prompt = [
    "أنت مفرّغ صوتي محترف. فرّغ هذا التسجيل لمحاضرة تعليمية باللغة العربية تفريغًا كاملًا.",
    "التزم بالآتي:",
    "- اكتب كل ما قيل دون اختصار أو تلخيص أو حذف.",
    "- صحّح أخطاء النطق الواضحة واكتب المصطلحات العلمية بصياغتها الصحيحة.",
    "- قسّم النص إلى فقرات مترابطة حسب تغيّر الموضوع.",
    "- لا تضف أي تعليق أو عنوان أو مقدمة من عندك، ولا تكتب أختام الوقت.",
    "أخرج نص التفريغ فقط.",
  ].join("\n");

  const text = await generate(
    [{ text: prompt }, { file_data: { mime_type: mimeType, file_uri: fileUri } }],
    { maxOutputTokens: 65536, thinkingBudget: 0 },
  );
  if (!text) throw new AppError("transcribe_failed");
  return text;
}

export async function extractSlides(fileUri: string) {
  const prompt = [
    "استخرج النص الكامل من ملف الشرائح المرفق.",
    "التزم بالآتي:",
    "- اكتب محتوى كل شريحة بالترتيب، وابدأ كل شريحة بسطر: ## شريحة رقم N",
    "- انقل العناوين والنقاط والجداول كما هي دون تلخيص.",
    "- صف الصور والرسوم البيانية وصفًا موجزًا بين قوسين إن كانت تحمل معنى.",
    "- لا تضف أي تعليق من عندك.",
    "أخرج النص المستخرج فقط.",
  ].join("\n");

  const text = await generate(
    [{ text: prompt }, { file_data: { mime_type: "application/pdf", file_uri: fileUri } }],
    { maxOutputTokens: 32768, thinkingBudget: 0 },
  );
  if (!text) throw new AppError("slides_failed");
  return text;
}

/**
 * The merge stage. Slides give the skeleton and the ordering; the transcript
 * gives the explanation the lecturer actually delivered. The output shape is
 * fixed because the Word export and the reading page both depend on it.
 */
export async function buildDocument(input: {
  title: string;
  subject: string;
  transcript: string;
  slidesText: string;
}) {
  const prompt = [
    `أنت خبير في إعداد المواد التعليمية. أمامك تفريغ صوتي لمحاضرة بعنوان «${input.title}» ضمن مادة «${input.subject}»، ومعه النص المستخرج من شرائح العرض المصاحبة.`,
    "اكتب مستندًا تعليميًا متكاملًا بالعربية الفصحى الحديثة بصيغة Markdown، بهذا الترتيب وبهذه العناوين بالضبط:",
    "",
    "## الملخص التنفيذي",
    "فقرة واحدة من جملتين إلى ثلاث جمل تلخّص المحاضرة.",
    "",
    "## المحتوى",
    "النقاط الرئيسية بعنوان من المستوى الثالث (###)، وتحت كل نقطة رئيسية نقاطها الفرعية بعنوان من المستوى الرابع (####)، وتحت كل نقطة فرعية فقرة شرح وافية تدمج ما هو مكتوب في الشريحة مع شرح المحاضر المنطوق. الفقرة يجب أن تكون شرحًا مفهومًا قائمًا بذاته لا مجرد إعادة لنقاط الشريحة.",
    "",
    "## أهم ما يجب تذكّره",
    "من ثلاث إلى خمس نقاط.",
    "",
    "## أسئلة المراجعة",
    "ثمانية أسئلة اختيار من متعدد، لكل سؤال أربعة خيارات مرقّمة (أ) و(ب) و(ج) و(د)، ثم خمسة أسئلة صواب وخطأ. لا تكتب الإجابات هنا إطلاقًا.",
    "",
    "## الإجابات",
    "إجابات أسئلة الاختيار من متعدد ثم إجابات أسئلة الصواب والخطأ، مرقّمة بنفس ترتيب الأسئلة.",
    "",
    "قواعد ملزمة:",
    "- اعتمد على الشرائح في ترتيب الموضوعات، وعلى التفريغ في التفصيل والشرح.",
    "- لا تخترع معلومات غير موجودة في المصدرين.",
    "- لا تكتب أي مقدمة أو خاتمة أو تعليق خارج الأقسام الخمسة.",
    "- لا تضع خرائط ذهنية ولا أي قسم إضافي.",
    "- ابدأ الإخراج مباشرة بسطر «## الملخص التنفيذي».",
    "",
    "=== نص الشرائح ===",
    input.slidesText,
    "",
    "=== التفريغ الصوتي ===",
    input.transcript,
  ].join("\n");

  const text = await generate([{ text: prompt }], {
    maxOutputTokens: 65536,
    thinkingBudget: 4096,
  });
  if (!text) throw new AppError("document_failed");
  return text;
}
