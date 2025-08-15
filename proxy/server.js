import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import morgan from "morgan";

const app = express();
// 如需更严格可改：cors({ origin: "http://gaga0714.site:10003" })
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("tiny"));

const TARGET_BASE = "https://api.deepseek.com";
const API_KEY = process.env.DEEPSEEK_API_KEY;

if (!API_KEY) {
  console.error("Missing DEEPSEEK_API_KEY env");
  process.exit(1);
}

app.all("/api/deepseek/*", async (req, res) => {
  try {
    const upstreamPath = req.originalUrl.replace(/^\/api\/deepseek/, "");
    const url = TARGET_BASE + upstreamPath;

    const headers = {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": req.get("Content-Type") || "application/json",
    };

    const init = {
      method: req.method,
      headers,
      body: ["GET","HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {})
    };

    const r = await fetch(url, init);
    const text = await r.text();

    res.status(r.status);
    try { res.json(JSON.parse(text)); } catch { res.send(text); }
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Bad gateway" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`aiwebchat proxy running on :${port}`));
