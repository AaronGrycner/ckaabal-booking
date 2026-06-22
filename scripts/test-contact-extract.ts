/**
 * Local contact extraction tests using static HTML fixtures.
 * Run: npm run test:contacts
 */
import * as cheerio from "cheerio";
import {
  extractContactsFromHtml,
  mergeContacts,
  normalizeEmail,
} from "../src/lib/services/contact-extract";

type TestResult = { name: string; ok: boolean; detail?: string };

const failures: TestResult[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  if (!condition) failures.push({ name, ok: false, detail });
}

function load(html: string) {
  return cheerio.load(html);
}

function testMailtoBeatsVisibleHomepage() {
  const homeHtml = `<html><body>Reach us at owner@example.com</body></html>`;
  const contactHtml = `<html><body><a href="mailto:hello@example.com">Email</a></body></html>`;

  const home = extractContactsFromHtml(
    load(homeHtml),
    homeHtml,
    "https://example.com",
    "homepage",
  );
  const contact = extractContactsFromHtml(
    load(contactHtml),
    contactHtml,
    "https://example.com/contact",
    "contact",
  );

  const merged = mergeContacts([home, contact], [
    "https://example.com",
    "https://example.com/contact",
  ]);

  assert(
    "mailto on contact page beats visible homepage email",
    merged.bestEmail === "hello@example.com",
    `expected hello@example.com, got ${merged.bestEmail}`,
  );
  assert(
    "best email confidence is high",
    merged.emailConfidence === "high",
    `expected high, got ${merged.emailConfidence}`,
  );
  assert(
    "best email source is contact page mailto",
    merged.emailSource?.includes("contact page mailto") ?? false,
    `source: ${merged.emailSource}`,
  );
}

function testVisibleTextBeatsAttributeOnly() {
  const html = `<html><body>
    Email us at bookings@example.com
    <img src="/assets/logo@2x.png" data-email="hidden@example.com" />
  </body></html>`;

  const result = extractContactsFromHtml(
    load(html),
    html,
    "https://example.com",
    "homepage",
  );
  const merged = mergeContacts([result], ["https://example.com"]);

  assert(
    "visible text beats attribute-only email",
    merged.bestEmail === "bookings@example.com",
    `expected bookings@example.com, got ${merged.bestEmail}`,
  );
  assert(
    "best email confidence is medium",
    merged.emailConfidence === "medium",
    `expected medium, got ${merged.emailConfidence}`,
  );

  const hidden = merged.emails.find((e) => e.email === "hidden@example.com");
  if (hidden) {
    assert(
      "attribute-only email is low confidence",
      hidden.confidence === "low",
      `expected low, got ${hidden.confidence}`,
    );
  }
}

function testJunkEmailsIgnored() {
  const html = `<html><body>
    noreply@shop.com help@sentry.io support@wix.com logo@cdn.example.png
  </body></html>`;

  const result = extractContactsFromHtml(
    load(html),
    html,
    "https://example.com",
    "homepage",
  );
  const merged = mergeContacts([result], ["https://example.com"]);

  const addresses = merged.emails.map((e) => e.email);
  assert(
    "junk/platform emails ignored",
    addresses.length === 0 && merged.bestEmail === null,
    `unexpected emails: ${addresses.join(", ")}`,
  );
}

function testTrailingPunctuationStripped() {
  const html = `<html><body>
    Email us: hello@example.com.
    <a href="mailto:info@example.com;">Info</a>
  </body></html>`;

  const result = extractContactsFromHtml(
    load(html),
    html,
    "https://example.com",
    "homepage",
  );

  const emails = result.emails.map((e) => e.email);
  assert(
    "trailing punctuation stripped from visible text",
    emails.includes("hello@example.com") && !emails.includes("hello@example.com."),
    `emails: ${emails.join(", ")}`,
  );
  assert(
    "trailing punctuation stripped from mailto",
    emails.includes("info@example.com"),
    `emails: ${emails.join(", ")}`,
  );
  assert(
    "normalizeEmail strips semicolon",
    normalizeEmail("info@example.com;") === "info@example.com",
    normalizeEmail("info@example.com;"),
  );
}

function testNoDomainGuessing() {
  const html = `<html><head>
    <meta property="og:url" content="https://example.com" />
    <title>Example Salon</title>
  </head><body><p>Welcome to our salon.</p></body></html>`;

  const result = extractContactsFromHtml(
    load(html),
    html,
    "https://example.com",
    "homepage",
  );
  const merged = mergeContacts([result], ["https://example.com"]);

  assert(
    "no email guessed from domain",
    merged.emails.length === 0 && merged.bestEmail === null,
    `unexpected bestEmail: ${merged.bestEmail}, emails: ${merged.emails.map((e) => e.email).join(", ")}`,
  );
  assert(
    "no info@example.com invented",
    !merged.emails.some((e) => e.email === "info@example.com"),
    "found info@example.com",
  );
  assert(
    "no hello@example.com invented",
    !merged.emails.some((e) => e.email === "hello@example.com"),
    "found hello@example.com",
  );
}

testMailtoBeatsVisibleHomepage();
testVisibleTextBeatsAttributeOnly();
testJunkEmailsIgnored();
testTrailingPunctuationStripped();
testNoDomainGuessing();

const total = 5;
const failed = failures.length;

if (failed > 0) {
  for (const f of failures) {
    console.error(`FAIL: ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
  }
  console.error(`\ncontact-extract tests: ${total - failed}/${total} passed`);
  process.exit(1);
}

console.log(`contact-extract tests: ${total} passed`);
