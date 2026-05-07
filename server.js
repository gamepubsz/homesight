const path = require("path");
const express = require("express");
const { analyzeListingUrl } = require("./src/analyze-listing");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname)));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "homesight-mvp-api" });
});

app.post("/api/analyze", async (req, res) => {
  const listingUrl = req.body?.listingUrl?.trim();
  if (!listingUrl) {
    return res.status(400).json({ error: "listingUrl is required." });
  }

  try {
    const analysis = await analyzeListingUrl(listingUrl);
    return res.json(analysis);
  } catch (error) {
    return res.status(422).json({
      error: "Could not analyze this listing URL.",
      detail: error instanceof Error ? error.message : "Unknown failure"
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Homesight MVP running on http://localhost:${port}`);
  });
}

module.exports = app;
