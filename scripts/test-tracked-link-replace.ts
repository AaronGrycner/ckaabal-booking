import {
  buildTrackedLinkUrl,
  getOutreachTrackingConfig,
  prepareOutreachEmailBodyWithTrackedLink,
  replaceSignatureUrlInEmailBody,
  resolveTrackedLinkDestination,
} from "../src/lib/services/outreach-tracking";

const TRACKED = "https://click.dreamlabwebdesign.com/r/testtoken123";

process.env.OUTREACH_WEBSITE = "dreamlabwebdesign.com";

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    process.exit(1);
  }
  console.log(`OK: ${name}`);
}

function withTrackingBaseUrl(value: string, fn: () => void) {
  const previous = process.env.OUTREACH_TRACKING_BASE_URL;
  process.env.OUTREACH_TRACKING_BASE_URL = value;
  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env.OUTREACH_TRACKING_BASE_URL;
    } else {
      process.env.OUTREACH_TRACKING_BASE_URL = previous;
    }
  }
}

const signatureBody = [
  "--",
  "Aaron Grycner",
  "Founder, DreamLab Web Design",
  "Modern websites for small businesses",
  "",
  "dreamlabwebdesign.com",
  "hello@dreamlabwebdesign.com",
].join("\n");

const replaced = replaceSignatureUrlInEmailBody(signatureBody, TRACKED);

assert(
  "website line replaced",
  replaced.includes(TRACKED) && !replaced.includes("\ndreamlabwebdesign.com\n"),
);
assert(
  "email line unchanged",
  replaced.includes("hello@dreamlabwebdesign.com"),
);
assert(
  "email line not corrupted",
  !replaced.includes(`hello@${TRACKED}`) &&
    !replaced.includes("hello@https://click.dreamlabwebdesign.com"),
);

const inlineBody = "Visit dreamlabwebdesign.com today\nhello@dreamlabwebdesign.com";
const inlineReplaced = replaceSignatureUrlInEmailBody(inlineBody, TRACKED);

assert(
  "inline website mention unchanged",
  inlineReplaced.startsWith("Visit dreamlabwebdesign.com today"),
);
assert(
  "inline email unchanged",
  inlineReplaced.includes("hello@dreamlabwebdesign.com"),
);

const httpsLine = replaceSignatureUrlInEmailBody(
  "https://www.dreamlabwebdesign.com",
  TRACKED,
);
assert("https www variant replaced", httpsLine === TRACKED);

const gluedBody = [
  "--",
  "Aaron Grycner",
  "dreamlabwebdesign.comhello@dreamlabwebdesign.com",
].join("\n");
const gluedReplaced = replaceSignatureUrlInEmailBody(gluedBody, TRACKED);

assert(
  "glued website+email split and tracked",
  gluedReplaced.includes(`${TRACKED}\nhello@dreamlabwebdesign.com`),
);
assert(
  "glued line not corrupted",
  !gluedReplaced.includes(`${TRACKED}hello@dreamlabwebdesign.com`),
);

withTrackingBaseUrl(
  "OUTREACH_TRACKING_BASE_URL=https://click.dreamlabwebdesign.com",
  () => {
    const config = getOutreachTrackingConfig();
    assert(
      "env line paste stripped from tracking base URL",
      config.trackingBaseUrl === "https://click.dreamlabwebdesign.com",
    );
    assert(
      "tracked link URL has no env key prefix",
      buildTrackedLinkUrl("abc") ===
        "https://click.dreamlabwebdesign.com/r/abc",
    );
  },
);

withTrackingBaseUrl("https://click.dreamlabwebdesign.com", () => {
  const prepared = prepareOutreachEmailBodyWithTrackedLink(signatureBody, {
    id: 1,
    token: "testtoken123",
    leadId: 1,
    destinationUrl: "https://dreamlabwebdesign.com",
    linkType: "signature",
    campaign: null,
    isActive: true,
    clickCount: 0,
    lastClickedAt: null,
    createdAt: new Date(),
  });

  assert(
    "html uses display text for tracked link",
    prepared.html.includes(
      `<a href="https://click.dreamlabwebdesign.com/r/testtoken123">dreamlabwebdesign.com</a>`,
    ),
  );
  assert(
    "html does not expose raw tracking URL as visible text",
    !prepared.html.includes(
      ">https://click.dreamlabwebdesign.com/r/testtoken123<",
    ),
  );
  assert(
    "plain text keeps tracked URL for non-html clients",
    prepared.text.includes("https://click.dreamlabwebdesign.com/r/testtoken123"),
  );
});

process.env.OUTREACH_DEFAULT_TRACKED_DESTINATION =
  "https://dreamlabwebdesign.com/?utm_source=cold_email&utm_medium=email&utm_campaign=outreach&utm_content=signature";

assert(
  "localhost stored destination resolves to production default",
  resolveTrackedLinkDestination("http://localhost:3000/?utm_source=cold_email") ===
    process.env.OUTREACH_DEFAULT_TRACKED_DESTINATION,
);
assert(
  "production stored destination is unchanged",
  resolveTrackedLinkDestination("https://dreamlabwebdesign.com/custom") ===
    "https://dreamlabwebdesign.com/custom",
);

console.log("All tracked link replacement checks passed.");
