export const WEEKLY_REPORT_MODEL = "gpt-5-nano";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type OpenAiTextContent = {
  type?: string;
  text?: string;
};

type OpenAiOutputItem = {
  type?: string;
  content?: OpenAiTextContent[];
};

type OpenAiResponseBody = {
  id?: string;
  status?: string;
  output_text?: string;
  output?: OpenAiOutputItem[];
  error?: {
    message?: string;
  };
};

type OpenAiDiagnostics = {
  id: string | null;
  status: string | null;
  httpStatus: number;
  outputItemTypes: string[];
  contentItemTypes: string[];
  outputTextExists: boolean;
};

function getDiagnostics(body: OpenAiResponseBody, httpStatus: number): OpenAiDiagnostics {
  return {
    id: body.id ?? null,
    status: body.status ?? null,
    httpStatus,
    outputItemTypes:
      body.output?.map((item) => item.type ?? "unknown") ?? [],
    contentItemTypes:
      body.output?.flatMap((item) =>
        item.content?.map((content) => content.type ?? "unknown") ?? [],
      ) ?? [],
    outputTextExists: typeof body.output_text === "string",
  };
}

function extractOutputText(body: OpenAiResponseBody) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => typeof content.text === "string" && content.text.trim())
      .map((content) => content.text)
      .join("\n")
      .trim() ?? ""
  );
}

export async function generateWeeklyReportInsight(metrics: unknown) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: WEEKLY_REPORT_MODEL,
      instructions: [
        "You write NOVA weekly insight reports.",
        "Use British English.",
        "Be short, practical, honest, and supportive without being cheesy.",
        "Do not invent facts or mention data that is not in the metrics object.",
        "Only mention numbers when they support an insight.",
        "Focus on behavioural patterns, practical insights, recommendations, and trends.",
        "Return plain text only, with 3 to 5 concise bullets.",
      ].join(" "),
      input: `Structured weekly metrics:\n${JSON.stringify(metrics)}`,
      max_output_tokens: 450,
      store: false,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as OpenAiResponseBody;
  const diagnostics = getDiagnostics(body, response.status);

  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `OpenAI request failed with ${response.status}.`,
    );
  }

  console.info("[weekly-ai] OpenAI response diagnostics.", diagnostics);

  const text = extractOutputText(body);

  if (!text) {
    throw new Error(
      `OpenAI returned an empty weekly report. Diagnostics: ${JSON.stringify(diagnostics)}`,
    );
  }

  return {
    model: WEEKLY_REPORT_MODEL,
    text,
  };
}
