import type { PlaceResult } from "../dedupe";
import { formatCategory, parseCityFromAddress } from "../dedupe";
import { analyzeVenueResearch } from "../venue-research";

const MOCK_BUSINESS_HOURS = [
  "Monday: Closed",
  "Tuesday: 7:00 PM – 2:00 AM",
  "Wednesday: 7:00 PM – 2:00 AM",
  "Thursday: 7:00 PM – 2:00 AM",
  "Friday: 5:00 PM – 2:00 AM",
  "Saturday: 5:00 PM – 2:00 AM",
  "Sunday: 6:00 PM – 12:00 AM",
].join("\n");

export function getMockPlaces(
  query: string,
  location: string,
  maxResults: number,
): PlaceResult[] {
  const base: PlaceResult[] = [
    {
      placeId: "mock-1",
      businessName: "The Echo",
      category: "live music venue",
      address: "1822 W Sunset Blvd, Los Angeles, CA 90026",
      city: "Los Angeles",
      phone: "(213) 555-0101",
      websiteUrl: "https://example-echo-venue.com",
      mapsUrl: "https://maps.google.com/?q=The+Echo+LA",
      rating: 4.6,
      reviewCount: 412,
      businessStatus: "OPERATIONAL",
    },
    {
      placeId: "mock-2",
      businessName: "Mohawk Austin",
      category: "music venue",
      address: "912 Red River St, Austin, TX 78701",
      city: "Austin",
      phone: "(512) 555-0102",
      websiteUrl: "https://example-mohawk.com",
      mapsUrl: "https://maps.google.com/?q=Mohawk+Austin",
      rating: 4.5,
      reviewCount: 890,
      businessStatus: "OPERATIONAL",
    },
    {
      placeId: "mock-3",
      businessName: "Mercury Lounge",
      category: "bar",
      address: "217 E Houston St, New York, NY 10002",
      city: "New York",
      phone: "(212) 555-0103",
      websiteUrl: "https://example-mercury.com",
      mapsUrl: "https://maps.google.com/?q=Mercury+Lounge",
      rating: 4.4,
      reviewCount: 620,
      businessStatus: "OPERATIONAL",
    },
    {
      placeId: "mock-4",
      businessName: "House of Blues Chicago",
      category: "concert hall",
      address: "329 N Dearborn St, Chicago, IL 60654",
      city: "Chicago",
      phone: "(312) 555-0104",
      websiteUrl: "https://example-houseofblues.com",
      mapsUrl: "https://maps.google.com/?q=House+of+Blues+Chicago",
      rating: 4.3,
      reviewCount: 2100,
      businessStatus: "OPERATIONAL",
    },
    {
      placeId: "mock-5",
      businessName: "The Hideout",
      category: "bar",
      address: "1354 W Wabansia Ave, Chicago, IL 60642",
      city: "Chicago",
      phone: "(773) 555-0105",
      websiteUrl: "https://example-hideout.com",
      mapsUrl: "https://maps.google.com/?q=The+Hideout+Chicago",
      rating: 4.7,
      reviewCount: 340,
      businessStatus: "OPERATIONAL",
    },
    {
      placeId: "mock-6",
      businessName: "Neighborhood Taproom",
      category: "bar",
      address: "450 S Raymond Ave, Pasadena, CA 91105",
      city: "Pasadena",
      phone: null,
      websiteUrl: null,
      mapsUrl: "https://maps.google.com/?q=Neighborhood+Taproom",
      rating: 4.2,
      reviewCount: 88,
      businessStatus: "OPERATIONAL",
    },
    {
      placeId: "mock-7",
      businessName: "The Independent",
      category: "music venue",
      address: "628 Divisadero St, San Francisco, CA 94117",
      city: "San Francisco",
      phone: "(415) 555-0107",
      websiteUrl: "https://example-independent.com",
      mapsUrl: "https://maps.google.com/?q=The+Independent+SF",
      rating: 4.6,
      reviewCount: 780,
      businessStatus: "OPERATIONAL",
    },
    {
      placeId: "mock-8",
      businessName: "9:30 Club",
      category: "night club",
      address: "815 V St NW, Washington, DC 20001",
      city: "Washington",
      phone: "(202) 555-0108",
      websiteUrl: "https://example-930club.com",
      mapsUrl: "https://maps.google.com/?q=930+Club",
      rating: 4.8,
      reviewCount: 3200,
      businessStatus: "OPERATIONAL",
    },
  ];

  return base.slice(0, maxResults).map((p) => ({
    ...p,
    businessHours: MOCK_BUSINESS_HOURS,
    city: p.city ?? parseCityFromAddress(p.address),
    category: p.category ?? formatCategory([p.category ?? ""]),
  }));
}

export function getMockPageSpeed(url: string) {
  if (url.includes("slow")) {
    return {
      mobilePerformanceScore: 38,
      seoScore: 62,
      accessibilityScore: 71,
      bestPracticesScore: 75,
      lcp: "4.2 s",
      cls: "0.18",
      tbt: "890 ms",
    };
  }
  return {
    mobilePerformanceScore: 72,
    seoScore: 78,
    accessibilityScore: 82,
    bestPracticesScore: 85,
    lcp: "2.4 s",
    cls: "0.05",
    tbt: "280 ms",
  };
}

export function getMockHtmlAudit(url: string) {
  const isEcho = url.includes("echo");
  const isMohawk = url.includes("mohawk");
  const isMercury = url.includes("mercury");
  const isHideout = url.includes("hideout");
  const isIndependent = url.includes("independent");

  let contacts;
  if (isEcho || isIndependent) {
    contacts = {
      emails: [
        {
          email: "booking@example-echo-venue.com",
          confidence: "high" as const,
          source: "booking page mailto link",
          pageUrl: `${url}/booking`,
        },
      ],
      bestEmail: "booking@example-echo-venue.com",
      emailConfidence: "high" as const,
      emailSource: "booking page mailto link",
      phones: ["(213) 555-0101"],
      instagramUrl: "https://instagram.com/theecho",
      facebookUrl: "https://facebook.com/theecho",
      linkedinUrl: null,
      pagesCrawled: [url, `${url}/booking`],
    };
  } else if (isMohawk) {
    contacts = {
      emails: [
        {
          email: "talent@mohawk.example.com",
          confidence: "medium" as const,
          source: "contact page visible text",
          pageUrl: `${url}/contact`,
        },
      ],
      bestEmail: "talent@mohawk.example.com",
      emailConfidence: "medium" as const,
      emailSource: "contact page visible text",
      phones: [],
      instagramUrl: "https://instagram.com/mohawkaustin",
      facebookUrl: null,
      linkedinUrl: null,
      pagesCrawled: [url, `${url}/contact`],
    };
  } else if (isMercury) {
    contacts = {
      emails: [
        {
          email: "info@mercury.example.com",
          confidence: "low" as const,
          source: "homepage visible text",
          pageUrl: url,
        },
      ],
      bestEmail: "info@mercury.example.com",
      emailConfidence: "low" as const,
      emailSource: "homepage visible text",
      phones: [],
      instagramUrl: null,
      facebookUrl: null,
      linkedinUrl: null,
      pagesCrawled: [url],
    };
  } else if (isHideout) {
    contacts = {
      emails: [],
      bestEmail: null,
      emailConfidence: null,
      emailSource: null,
      phones: ["(773) 555-0105"],
      instagramUrl: null,
      facebookUrl: null,
      linkedinUrl: null,
      pagesCrawled: [url],
    };
  } else {
    contacts = {
      emails: [],
      bestEmail: null,
      emailConfidence: null,
      emailSource: null,
      phones: [],
      instagramUrl: null,
      facebookUrl: null,
      linkedinUrl: null,
      pagesCrawled: [url],
    };
  }

  const pageHtml = isEcho
    ? "<html><body>Live music venue. Upcoming shows. Indie rock and folk acts. <a href='/booking'>Book a band</a></body></html>"
    : isMohawk
      ? "<html><body>Music venue Austin. Concert calendar. Rock and alternative bands. <a href='/contact'>Contact</a></body></html>"
      : isMercury
        ? "<html><body>Bar and live music. Jazz nights. <a href='/events'>Events</a></body></html>"
        : isHideout
          ? "<html><body>Neighborhood bar with live music on weekends. Local acts welcome.</body></html>"
          : "<html><body>Welcome</body></html>";

  const venueResearch = analyzeVenueResearch(
    cheerioTextFromHtml(pageHtml),
    pageHtml,
    url,
  );

  return {
    httpStatus: 200,
    hasHttps: true,
    title: isEcho ? "The Echo | Live Music Venue" : "Welcome",
    metaDescription: isEcho ? "Indie rock and live music in Los Angeles" : null,
    hasPhone: Boolean(contacts.phones.length),
    hasContactLink: isMohawk || isMercury,
    hasServicesContent: isEcho || isMohawk || isMercury || isHideout,
    hasBookingLink: isEcho || venueResearch.hasTalentBookingPage,
    detectedBuilder: null,
    ecommerceHeavy: false,
    brokenLinks: { checked: 4, broken: 0, samples: [] },
    siteHealth: {
      hasViewportMeta: true,
      hasH1: true,
      h1Count: 1,
      imagesTotal: 6,
      imagesMissingAlt: 1,
      hasNoindex: false,
      hasFavicon: true,
      hasOpenGraph: true,
      wordCount: 220,
      thinContent: false,
    },
    bestEmail: contacts.bestEmail,
    emailConfidence: contacts.emailConfidence,
    emailSource: contacts.emailSource,
    contacts,
    venueResearch,
  };
}

function cheerioTextFromHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
