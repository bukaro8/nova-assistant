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
  output_text?: string;
  output?: OpenAiOutputItem[];
  error?: {
    message?: string;
  };
};

function extractOutputText(body: OpenAiResponseBody) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text" && content.text)
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

  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `OpenAI request failed with ${response.status}.`,
    );
  }

  const text = extractOutputText(body);

  if (!text) {
    throw new Error("OpenAI returned an empty weekly report.");
  }

  return {
    model: WEEKLY_REPORT_MODEL,
    text,
  };
}
