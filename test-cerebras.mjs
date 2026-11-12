// Quick smoke test: does the Cerebras key work and parse a pidgin report?
const key = process.env.CEREBRAS_API_KEY;
const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({
    model: "gpt-oss-120b",
    messages: [
      {
        role: "system",
        content:
          'You parse citizen outage reports for Cameroon. Reply with ONLY compact JSON: {"type":"light"|"water","quartierName":string|null,"status":"out"|"restored","since":string|null,"language":"english"|"french"|"pidgin"|"other","confidence":0.0-1.0}',
      },
      {
        role: "user",
        content: "We no get light for Bonamoussadi since morning",
      },
    ],
    temperature: 0,
    max_tokens: 512,
    response_format: { type: "json_object" },
  }),
});
console.log("status:", res.status);
console.log(JSON.stringify(await res.json(), null, 2).slice(0, 1200));
