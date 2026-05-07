const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractListingData,
  calculateEstimatedPayment,
  computeAmenityScore
} = require("../src/analyze-listing");

test("extractListingData reads JSON-LD listing fields", () => {
  const html = `
    <html>
      <head>
        <title>Example Listing</title>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "SingleFamilyResidence",
            "name": "123 Maple Street",
            "description": "Beautiful home",
            "numberOfBedrooms": 3,
            "numberOfBathroomsTotal": 2,
            "floorSize": {"@type":"QuantitativeValue","value": 1680},
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "123 Maple St",
              "addressLocality": "Austin",
              "addressRegion": "TX",
              "postalCode": "78701"
            },
            "offers": {
              "@type": "Offer",
              "price": "450000",
              "priceCurrency": "USD"
            }
          }
        </script>
      </head>
      <body></body>
    </html>
  `;

  const result = extractListingData(html, "https://example.com/listings/123");
  assert.equal(result.title, "123 Maple Street");
  assert.equal(result.price, 450000);
  assert.equal(result.bedrooms, 3);
  assert.equal(result.bathrooms, 2);
  assert.equal(result.squareFeet, 1680);
  assert.equal(result.currency, "USD");
  assert.equal(result.address, "123 Maple St, Austin, TX, 78701");
});

test("calculateEstimatedPayment computes monthly payment", () => {
  const payment = calculateEstimatedPayment(500000, 6.5);
  assert.ok(payment > 2000);
  assert.ok(payment < 4000);
});

test("computeAmenityScore stays inside expected bounds", () => {
  const low = computeAmenityScore({
    schools: 0,
    parks: 0,
    supermarkets: 0,
    hospitals: 0,
    transitStops: 0
  });
  const high = computeAmenityScore({
    schools: 10,
    parks: 10,
    supermarkets: 10,
    hospitals: 10,
    transitStops: 20
  });
  assert.ok(low >= 1 && low <= 10);
  assert.ok(high >= 1 && high <= 10);
  assert.ok(high > low);
});
