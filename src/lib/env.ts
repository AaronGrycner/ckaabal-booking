export function getEnv() {
  const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
  const pageSpeedApiKey =
    process.env.PAGESPEED_API_KEY?.trim() ||
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    "";
  const mockMode = process.env.MOCK_MODE === "true";
  const tursoDatabaseUrl = process.env.TURSO_DATABASE_URL?.trim() ?? "";
  const databaseUrl =
    tursoDatabaseUrl ||
    process.env.DATABASE_URL?.trim() ||
    "file:./data/booking-crm.db";

  return {
    googlePlacesApiKey,
    pageSpeedApiKey,
    databaseUrl,
    tursoDatabaseUrl,
    usesTurso: Boolean(tursoDatabaseUrl),
    hasPlacesKey: Boolean(googlePlacesApiKey),
    hasPageSpeedKey: Boolean(pageSpeedApiKey),
    isMockMode: mockMode || !googlePlacesApiKey,
  };
}
