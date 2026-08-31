export const PROVIDERS = [
  "Airtel",
  "Jio",
  "BSNL",
  "Vi",
  "ACT Fibernet",
  "Other",
];
export const COORDINATION = [
  "Not required",
  "Not yet contacted",
  "Forwarded to provider",
  "Awaiting provider response",
  "Provider action in progress",
  "Provider confirms restored",
];
export const WARDS = [
  "Demo Ward 01 · Bengaluru",
  "Demo Ward 02 · Bengaluru",
  "Demo Ward 03 · Bengaluru",
  "Locality to be verified",
];
export function validateCivicInput(
  body: Record<string, unknown>,
  category: string,
) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 5 || title.length > 120)
    throw new Error("Enter a complaint title of 5–120 characters.");
  const ward =
    typeof body.ward === "string"
      ? body.ward.trim()
      : "Locality to be verified";
  if (ward.length < 3 || ward.length > 120)
    throw new Error("Enter a locality/ward of 3–120 characters.");
  const chosen = typeof body.provider === "string" ? body.provider : "";
  const other =
    typeof body.otherProvider === "string" ? body.otherProvider.trim() : "";
  let provider = "";
  if (category === "Internet & mobile network") {
    if (!PROVIDERS.includes(chosen))
      throw new Error("Select the internet/mobile service provider.");
    if (chosen === "Other" && (other.length < 2 || other.length > 80))
      throw new Error(
        "Enter the other service provider’s name (2–80 characters).",
      );
    provider = chosen === "Other" ? other : chosen;
  }
  return { title, ward, provider };
}
