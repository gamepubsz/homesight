const cheerio = require("cheerio");

const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT = "homesight-mvp/1.0 (listing analyzer prototype)";

function withTimeout(timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

async function fetchText(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const { controller, timeout } = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeNumber(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstTruthy(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function extractJsonLdObjects($) {
  const nodes = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        nodes.push(...parsed);
      } else {
        nodes.push(parsed);
      }
    } catch {
      // Ignore invalid JSON-LD scripts.
    }
  });
  return nodes;
}

function flattenGraphNodes(nodes) {
  const flat = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    flat.push(node);
    if (Array.isArray(node["@graph"])) {
      flat.push(...node["@graph"]);
    }
  }
  return flat;
}

function typeMatches(node, expectedTypes) {
  if (!node || typeof node !== "object") return false;
  const rawType = node["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  return types.some((type) => typeof type === "string" && expectedTypes.includes(type));
}

function formatAddress(address) {
  if (!address) return null;
  if (typeof address === "string") return address;
  if (typeof address !== "object") return null;
  const parts = [
    address.streetAddress,
    address.addressLocality,
    address.addressRegion,
    address.postalCode
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function getOffersPrice(offers) {
  if (!offers) return null;
  if (Array.isArray(offers)) {
    for (const offer of offers) {
      const price = normalizeNumber(offer?.price);
      if (price) return price;
    }
    return null;
  }
  return normalizeNumber(offers.price);
}

function getFloorSize(squareLike) {
  if (!squareLike) return null;
  if (typeof squareLike === "number") return squareLike;
  if (typeof squareLike === "string") return normalizeNumber(squareLike);
  if (typeof squareLike === "object") {
    return normalizeNumber(squareLike.value ?? squareLike.maxValue ?? squareLike.minValue);
  }
  return null;
}

function extractListingData(html, listingUrl) {
  const $ = cheerio.load(html);
  const url = new URL(listingUrl);
  const sourceHost = url.hostname.replace(/^www\./, "");
  const jsonLdNodes = flattenGraphNodes(extractJsonLdObjects($));

  const listingNode = jsonLdNodes.find((node) =>
    typeMatches(node, [
      "SingleFamilyResidence",
      "Residence",
      "House",
      "Apartment",
      "Product",
      "Offer",
      "RealEstateListing"
    ])
  );

  const addressNode = jsonLdNodes.find((node) => typeMatches(node, ["PostalAddress"]));
  const offerNode = jsonLdNodes.find((node) => typeMatches(node, ["Offer"])) || null;

  const title = firstTruthy(
    listingNode?.name,
    $('meta[property="og:title"]').attr("content"),
    $("title").text().trim()
  );
  const description = firstTruthy(
    listingNode?.description,
    $('meta[property="og:description"]').attr("content"),
    $('meta[name="description"]').attr("content")
  );
  const address = firstTruthy(
    formatAddress(listingNode?.address),
    formatAddress(addressNode),
    $('meta[property="og:street-address"]').attr("content")
  );
  const price = firstTruthy(
    getOffersPrice(listingNode?.offers),
    getOffersPrice(offerNode),
    normalizeNumber($('meta[property="product:price:amount"]').attr("content"))
  );
  const currency = firstTruthy(
    listingNode?.offers?.priceCurrency,
    offerNode?.priceCurrency,
    $('meta[property="product:price:currency"]').attr("content"),
    "USD"
  );
  const bedrooms = firstTruthy(
    normalizeNumber(listingNode?.numberOfBedrooms),
    normalizeNumber($('meta[property="home:bedrooms"]').attr("content"))
  );
  const bathrooms = firstTruthy(
    normalizeNumber(listingNode?.numberOfBathroomsTotal),
    normalizeNumber(listingNode?.numberOfBathrooms),
    normalizeNumber($('meta[property="home:bathrooms"]').attr("content"))
  );
  const squareFeet = firstTruthy(
    getFloorSize(listingNode?.floorSize),
    normalizeNumber(listingNode?.floorSize),
    normalizeNumber($('meta[property="home:sqft"]').attr("content"))
  );
  const image = firstTruthy(
    Array.isArray(listingNode?.image) ? listingNode.image[0] : listingNode?.image,
    $('meta[property="og:image"]').attr("content")
  );

  return {
    url: listingUrl,
    sourceHost,
    title,
    description,
    address,
    price,
    currency,
    bedrooms,
    bathrooms,
    squareFeet,
    image
  };
}

async function geocodeAddress(address) {
  if (!address) return null;
  const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const text = await fetchText(endpoint, { headers: { Accept: "application/json" } });
  const parsed = JSON.parse(text);
  const first = Array.isArray(parsed) ? parsed[0] : null;
  if (!first) return null;
  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    displayName: first.display_name || null
  };
}

async function fetchMortgageRate30y() {
  const csv = await fetchText("https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US");
  const lines = csv.trim().split("\n").slice(1).reverse();
  for (const line of lines) {
    const [date, rateValue] = line.split(",");
    const rate = Number(rateValue);
    if (date && Number.isFinite(rate)) {
      return { rate, date };
    }
  }
  return null;
}

async function fetchWeather(lat, lon) {
  const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m&timezone=auto`;
  const raw = await fetchText(endpoint, { headers: { Accept: "application/json" } });
  const parsed = JSON.parse(raw);
  const current = parsed?.current;
  if (!current) return null;
  return {
    temperatureC: current.temperature_2m ?? null,
    windSpeedKph: current.wind_speed_10m ?? null
  };
}

function countAmenities(elements = []) {
  const counts = {
    schools: 0,
    parks: 0,
    supermarkets: 0,
    hospitals: 0,
    transitStops: 0
  };
  for (const element of elements) {
    const tags = element?.tags || {};
    if (tags.amenity === "school") counts.schools += 1;
    if (tags.leisure === "park") counts.parks += 1;
    if (tags.shop === "supermarket") counts.supermarkets += 1;
    if (tags.amenity === "hospital") counts.hospitals += 1;
    if (tags.highway === "bus_stop") counts.transitStops += 1;
  }
  return counts;
}

function computeAmenityScore(counts) {
  const scoreRaw =
    4.2 +
    Math.min(counts.schools, 5) * 0.65 +
    Math.min(counts.parks, 6) * 0.5 +
    Math.min(counts.supermarkets, 4) * 0.7 +
    Math.min(counts.hospitals, 3) * 0.45 +
    Math.min(counts.transitStops, 8) * 0.2;
  return Math.max(1, Math.min(10, Number(scoreRaw.toFixed(1))));
}

async function fetchAmenities(lat, lon) {
  const query = `[out:json][timeout:20];
(
  node(around:1600,${lat},${lon})[amenity=school];
  node(around:1600,${lat},${lon})[leisure=park];
  node(around:1600,${lat},${lon})[shop=supermarket];
  node(around:1600,${lat},${lon})[amenity=hospital];
  node(around:1600,${lat},${lon})[highway=bus_stop];
);
out body;`;
  const response = await fetchText("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain", Accept: "application/json" },
    body: query
  });
  const parsed = JSON.parse(response);
  const counts = countAmenities(parsed?.elements || []);
  return {
    counts,
    score: computeAmenityScore(counts)
  };
}

function calculateEstimatedPayment(price, mortgageRate) {
  if (!price || !mortgageRate) return null;
  const principal = price * 0.8;
  const monthlyRate = mortgageRate / 100 / 12;
  const months = 360;
  const factor = (monthlyRate * (1 + monthlyRate) ** months) / ((1 + monthlyRate) ** months - 1);
  return principal * factor;
}

function countKnownFields(listing) {
  const fields = [
    listing.title,
    listing.address,
    listing.price,
    listing.bedrooms,
    listing.bathrooms,
    listing.squareFeet
  ];
  const known = fields.filter((value) => value !== null && value !== undefined).length;
  return {
    known,
    total: fields.length
  };
}

function computeDealScore({ fieldCoverage, amenityScore, hasPrice, hasMortgageRate }) {
  let score = 40;
  score += (fieldCoverage.known / fieldCoverage.total) * 30;
  if (amenityScore) score += amenityScore * 2;
  if (hasPrice) score += 5;
  if (hasMortgageRate) score += 5;
  return Math.max(1, Math.min(100, Math.round(score)));
}

function buildRiskFlags({ listing, geocode, mortgageRate, amenities }) {
  const flags = [];
  if (!listing.price) flags.push("Listing price was not detected from page metadata.");
  if (!listing.address) flags.push("Full street address is missing; location analysis may be weaker.");
  if (!geocode) flags.push("Could not geocode this listing address for neighborhood signals.");
  if (!mortgageRate) flags.push("Live 30-year mortgage rate is temporarily unavailable.");
  if (amenities?.score && amenities.score < 6) {
    flags.push("Amenity density is below average for schools/parks/transit in a 1.6km radius.");
  }
  if (flags.length === 0) {
    flags.push("No major data gaps detected from currently available listing signals.");
  }
  return flags;
}

function buildActions({ listing, amenities, estimatedPayment, mortgageRate }) {
  const actions = [];
  actions.push({
    text: "Verify seller disclosures and permit history before offer.",
    level: "must"
  });

  if (listing.price && estimatedPayment) {
    actions.push({
      text: `Budget check: pressure-test payment near ${Math.round(mortgageRate + 0.75)}% interest.`,
      level: "finance"
    });
  }

  if (amenities?.score && amenities.score >= 7.5) {
    actions.push({
      text: "High amenity signal: consider faster tour-to-offer timeline.",
      level: "timing"
    });
  } else {
    actions.push({
      text: "Low amenity signal: compare this listing with nearby alternatives.",
      level: "compare"
    });
  }

  actions.push({
    text: "Run at least three nearby sold comps in your target budget band.",
    level: "data"
  });
  return actions;
}

async function analyzeListingUrl(listingUrl) {
  const listingUrlObj = new URL(listingUrl);
  if (!["http:", "https:"].includes(listingUrlObj.protocol)) {
    throw new Error("Listing URL must use http or https.");
  }

  const html = await fetchText(listingUrl);
  const listing = extractListingData(html, listingUrl);

  const [geocodeResult, mortgageRateResult] = await Promise.allSettled([
    geocodeAddress(listing.address),
    fetchMortgageRate30y()
  ]);

  const geocode = geocodeResult.status === "fulfilled" ? geocodeResult.value : null;
  const mortgageRate = mortgageRateResult.status === "fulfilled" ? mortgageRateResult.value : null;

  let amenities = null;
  let weather = null;
  if (geocode?.lat && geocode?.lon) {
    const [amenityResult, weatherResult] = await Promise.allSettled([
      fetchAmenities(geocode.lat, geocode.lon),
      fetchWeather(geocode.lat, geocode.lon)
    ]);
    amenities = amenityResult.status === "fulfilled" ? amenityResult.value : null;
    weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  }

  const estimatedPayment = calculateEstimatedPayment(listing.price, mortgageRate?.rate);
  const fieldCoverage = countKnownFields(listing);
  const dealScore = computeDealScore({
    fieldCoverage,
    amenityScore: amenities?.score ?? null,
    hasPrice: Boolean(listing.price),
    hasMortgageRate: Boolean(mortgageRate?.rate)
  });
  const riskFlags = buildRiskFlags({ listing, geocode, mortgageRate, amenities });
  const recommendedActions = buildActions({
    listing,
    amenities,
    estimatedPayment,
    mortgageRate: mortgageRate?.rate ?? null
  });

  return {
    listing,
    signals: {
      geocode,
      weather,
      amenities: amenities?.counts || null,
      amenityScore: amenities?.score || null,
      mortgageRate30y: mortgageRate?.rate || null,
      mortgageRateDate: mortgageRate?.date || null
    },
    analysis: {
      dealScore,
      estimatedMonthlyPayment: estimatedPayment ? Math.round(estimatedPayment) : null,
      dataCoverage: fieldCoverage,
      riskFlags,
      recommendedActions
    },
    metadata: {
      analyzedAt: new Date().toISOString()
    }
  };
}

module.exports = {
  analyzeListingUrl,
  extractListingData,
  calculateEstimatedPayment,
  computeAmenityScore
};
