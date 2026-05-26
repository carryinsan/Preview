const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function textPart(value) {
  return { parts: [{ text: value }] };
}

function stripCodeFence(raw, lang) {
  const match = raw.match(new RegExp("```" + lang + "\\s*([\\s\\S]*?)```", "i"));
  return match ? match[1].trim() : "";
}

function fallbackDesign() {
  const html = `
<main class="oracle-app">
  <header class="nav">
    <div class="logo">ORACLE</div>
    <nav>
      <a href="#vision">Vision</a>
      <a href="#modes">Modes</a>
      <a href="#memory">Memory</a>
      <a href="#pricing">Pricing</a>
    </nav>
    <button class="cta">Launch ORACLE</button>
  </header>

  <section class="hero">
    <div class="eyebrow">Premium AI orchestration platform</div>
    <h1>UNLEASH THE INTELLIGENCE ECOSYSTEM</h1>
    <p>ORACLE combines multiple reasoning engines into one adaptive intelligence system with persistent memory and premium conversational orchestration.</p>
    <div class="actions">
      <button class="primary">Experience ORACLE</button>
      <button class="secondary">Watch System Flow</button>
    </div>
  </section>

  <section class="grid">
    <article><h3>Advanced Memory</h3><p>Persistent context and relationship linking.</p></article>
    <article><h3>Adaptive Routing</h3><p>Route each task to the best reasoning mode.</p></article>
    <article><h3>Source-Aware</h3><p>Responses stay grounded and readable.</p></article>
  </section>

  <section class="pricing" id="pricing">
    <article><h3>Free</h3><p>For exploration.</p></article>
    <article><h3>Professional</h3><p>For daily use.</p></article>
    <article><h3>Oracle Elite</h3><p>For premium orchestration.</p></article>
  </section>
</main>`;
  const css = `
body{
  margin:0;
  font-family:Inter,system-ui,sans-serif;
  background:radial-gradient(circle at top,#1a2040 0%,#050507 55%);
  color:#fff;
}
.oracle-app{
  min-height:100vh;
  padding:24px;
  display:grid;
  gap:24px;
}
.nav,.grid,.pricing{
  display:grid;
  gap:16px;
}
.nav{
  grid-template-columns:1fr auto auto;
  align-items:center;
  padding:16px 18px;
  border:1px solid rgba(255,255,255,.1);
  border-radius:20px;
  background:rgba(255,255,255,.05);
  backdrop-filter:blur(18px);
}
.logo{font-weight:800;letter-spacing:.18em}
.nav a{color:#cbd3e8;text-decoration:none;margin-right:14px;font-size:14px}
.cta,.primary,.secondary{
  border:0;
  border-radius:14px;
  padding:12px 16px;
  font-weight:700;
}
.cta,.primary{background:linear-gradient(135deg,#4be3ff,#8b7dff);color:#fff}
.secondary{background:rgba(255,255,255,.06);color:#fff}
.hero{
  padding:40px 18px;
  border:1px solid rgba(255,255,255,.1);
  border-radius:28px;
  background:rgba(255,255,255,.04);
}
.hero h1{font-size:clamp(34px,6vw,72px);line-height:.95;margin:10px 0 16px;letter-spacing:-.05em}
.hero p{max-width:760px;color:#a8b0c5;line-height:1.7}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}
.grid,.pricing{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.grid article,.pricing article{
  padding:20px;
  border:1px solid rgba(255,255,255,.1);
  border-radius:22px;
  background:rgba(255,255,255,.04);
}
.grid h3,.pricing h3{margin:0 0 8px}
.grid p,.pricing p{margin:0;color:#a8b0c5}
`;
  return { html, css };
}

function parseBlocks(modelText) {
  const html = stripCodeFence(modelText, "html");
  const css = stripCodeFence(modelText, "css");
  if (html && css) return { html, css };

  const jsonMatch = modelText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.html === "string" && typeof parsed.css === "string") {
        return { html: parsed.html.trim(), css: parsed.css.trim() };
      }
    } catch {
      // fall through
    }
  }

  const fallback = fallbackDesign();
  if (fallback.html && fallback.css) return fallback;

  throw new Error("Unable to parse Gemini response.");
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  const systemInstruction = `
You are an elite frontend architect and UI designer.

Return ONLY two fenced code blocks in this exact order:
1) \`\`\`html
2) \`\`\`css

Rules:
- The HTML must be valid, semantic, and self-contained.
- The CSS must style the HTML into a production-ready, premium, responsive SaaS landing page.
- Use realistic, buildable UI. No explanations. No JSON. No markdown outside the two code fences.
- Make the design match the user's prompt.
`;

  const userPrompt = `
Build the UI from this brief:

${prompt}
`;

  const payload = {
    contents: [textPart(userPrompt)],
    systemInstruction: textPart(systemInstruction)
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini API error (${response.status}): ${detail || response.statusText}`);
  }

  const data = await response.json();
  const rawText =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || "";

  if (!rawText.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  return parseBlocks(rawText);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readBody(req);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return json(res, 400, { error: "Missing prompt." });
    }

    const output = await callGemini(prompt);
    return json(res, 200, output);
  } catch (error) {
    console.error(error);
    return json(res, 500, {
      error: error.message || "Internal server error."
    });
  }
};
