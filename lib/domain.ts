export const STATUSES = [
  "Reported",
  "Verified",
  "Assigned",
  "In progress",
  "Resolved",
  "Closed",
] as const;
export const CATEGORIES = [
  "Roads & footpaths",
  "Street lighting",
  "Waste & sanitation",
  "Water & drainage",
  "Parks & public spaces",
  "Needs classification",
  "Internet & mobile network",
] as const;
export const DEPARTMENTS = [
  "Unassigned",
  "Public Works",
  "Electrical Services",
  "Sanitation",
  "Water & Drainage",
  "Parks & Horticulture",
  "Telecom Coordination",
] as const;
export const PRIORITIES = [
  "Unassessed",
  "Low",
  "Medium",
  "High",
  "Urgent",
] as const;
export type Status = (typeof STATUSES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Department = (typeof DEPARTMENTS)[number];
export type LocationSource = "gps" | "manual" | "demo" | "description";
export interface Context {
  categoryReason: string;
  scale: string;
  access: string;
  safety: string;
  facilities: { name: string; type: string; distance: number }[];
  facilityNote: string;
}
export interface Report {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: Status;
  priority: Priority;
  department: Department;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationSource: LocationSource;
  photoKey: string | null;
  isDemo: boolean;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  revision: number;
  context: Context;
  ward?: string;
  provider?: string;
  assignee?: string;
  dueAt?: number | null;
  providerTicket?: string;
  coordination?: string;
  clarification?: string;
  escalated?: boolean;
  owned?: boolean;
  supportCount?: number;
  supported?: boolean;
  canContributePhoto?: boolean;
  photoApproved?: boolean;
  pendingPhotoId?: string | null;
  pendingPhotoKey?: string | null;
  demoPhoto?: string | null;
}
export interface ReportEvent {
  id: string;
  reportId: string;
  kind: string;
  note: string;
  actor: string;
  visibility: "public" | "internal";
  createdAt: number;
  photoKey: string | null;
}
export interface ReportInput {
  title?: string;
  description: string;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationSource: LocationSource;
  photoKey: string | null;
  requestId: string;
}
export const DEMO_LOCATIONS = [
  { name: "Market Road · Demo Central", latitude: 12.9721, longitude: 77.5953 },
  { name: "School Lane · Demo East", latitude: 12.9765, longitude: 77.6004 },
  { name: "Lake Walk · Demo South", latitude: 12.9638, longitude: 77.5887 },
];
export const DEMO_FACILITIES = [
  {
    name: "Demo Community School",
    type: "School",
    latitude: 12.9767,
    longitude: 77.6009,
  },
  {
    name: "Demo District Hospital",
    type: "Hospital",
    latitude: 12.9714,
    longitude: 77.5934,
  },
  {
    name: "Demo Transit Hub",
    type: "Transit",
    latitude: 12.9669,
    longitude: 77.5948,
  },
];
export function distanceMeters(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((c - a) * rad) / 2) ** 2 +
    Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
}
export function classify(description: string): Category {
  const text = description.toLowerCase();
  const matches: [Category, RegExp][] = [
    [
      "Internet & mobile network",
      /\b(internet|broadband|telecom|wi-?fi|mobile signal|network outage|fiber|fibre|service provider)\b/,
    ],
    [
      "Street lighting",
      /\b(street.?lights?|lamps?|light.?poles?|wiring|electric|cables?)\b/,
    ],
    [
      "Water & drainage",
      /\b(flood|flooding|waterlog|waterlogging|drains?|drainage|sewage|leaks?|leaking|manholes?)\b/,
    ],
    [
      "Waste & sanitation",
      /\b(garbage|rubbish|trash|waste|bins?|litter|dumping)\b/,
    ],
    [
      "Roads & footpaths",
      /\b(pothole|potholes|road|pavement|footpath|sidewalk|asphalt|kerb)\b/,
    ],
    [
      "Parks & public spaces",
      /\b(tree|park|branch|branches|playground|bench)\b/,
    ],
  ];
  return (
    matches.find(([, pattern]) => pattern.test(text))?.[0] ??
    "Needs classification"
  );
}
export function deriveContext(
  description: string,
  latitude: number | null,
  longitude: number | null,
  source: LocationSource,
): Context {
  const text = description.toLowerCase();
  return {
    categoryReason:
      "Suggested from keywords in the description. Staff should verify; photos are not automatically analysed.",
    scale: /\b(entire|whole|multiple|several|stretch|large)\b/.test(text)
      ? "Larger extent mentioned; measurements unverified."
      : "Not established from the description.",
    access: /\b(blocked|blocking|impassable|obstructed|obstruction)\b/.test(
      text,
    )
      ? "Possible access obstruction mentioned; confirm on review."
      : "Access impact not established.",
    safety:
      /\b(exposed|sparking|injury|injured|danger|dangerous|live wire|open manhole)\b/.test(
        text,
      )
        ? "Potential safety concern mentioned. Human review needed; this is not verified."
        : "Safety severity not assessed.",
    facilities:
      source === "demo" && latitude !== null && longitude !== null
        ? DEMO_FACILITIES.map((f) => ({
            name: f.name,
            type: f.type,
            distance: distanceMeters(
              latitude,
              longitude,
              f.latitude,
              f.longitude,
            ),
          }))
            .filter((f) => f.distance <= 1500)
            .sort((a, b) => a.distance - b.distance)
        : [],
    facilityNote:
      source === "demo"
        ? "Illustrative facilities only. Straight-line distances; not a verified municipal dataset."
        : "Live facility lookup is not connected. Location does not automatically determine priority.",
  };
}
export function titleFromDescription(text: string) {
  const first = text.trim().split(/[.!?\n]/)[0];
  return first.length > 75 ? first.slice(0, 72).trimEnd() + "…" : first;
}
export function statusClass(status: string) {
  return status.toLowerCase().replaceAll(" ", "-");
}
export function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(timestamp);
}
export function relativeTime(timestamp: number, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
}
export function validateReport(body: Record<string, unknown>): ReportInput {
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const locationText =
    typeof body.locationText === "string" ? body.locationText.trim() : "";
  if (description.length < 12 || description.length > 2000)
    throw new Error("Describe the issue in 12–2,000 characters.");
  if (locationText.length < 3 || locationText.length > 180)
    throw new Error("Add a location or landmark in 3–180 characters.");
  const latitude =
    body.latitude === null || body.latitude === undefined
      ? null
      : body.latitude;
  const longitude =
    body.longitude === null || body.longitude === undefined
      ? null
      : body.longitude;
  if (
    (latitude === null) !== (longitude === null) ||
    (latitude !== null &&
      (typeof latitude !== "number" ||
        !Number.isFinite(latitude) ||
        Math.abs(latitude) > 90)) ||
    (longitude !== null &&
      (typeof longitude !== "number" ||
        !Number.isFinite(longitude) ||
        Math.abs(longitude) > 180))
  )
    throw new Error(
      "The location coordinates are invalid. Please choose the location again.",
    );
  const source = body.locationSource as LocationSource;
  if (!["gps", "manual", "demo", "description"].includes(source))
    throw new Error("Choose how the location was provided.");
  if (source !== "description" && latitude === null)
    throw new Error("Coordinates are required for this location mode.");
  const accuracy = body.accuracy == null ? null : body.accuracy;
  if (
    accuracy !== null &&
    (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0)
  )
    throw new Error("Invalid location accuracy.");
  const photoKey = body.photoKey == null ? null : body.photoKey;
  if (
    photoKey !== null &&
    (typeof photoKey !== "string" ||
      !/^reports\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(photoKey))
  )
    throw new Error("The attached photo is invalid.");
  if (
    typeof body.requestId !== "string" ||
    !/^[a-f0-9-]{36}$/.test(body.requestId)
  )
    throw new Error(
      "Submission identifier is missing. Please reload and try again.",
    );
  return {
    description,
    locationText,
    latitude: latitude as number | null,
    longitude: longitude as number | null,
    accuracy: accuracy as number | null,
    locationSource: source,
    photoKey: photoKey as string | null,
    requestId: body.requestId,
  };
}
export function validateTransition(
  from: Status,
  to: Status,
  department: Department,
  note: string,
) {
  if (from === to) return;
  const allowed: Record<Status, Status[]> = {
    Reported: ["Verified"],
    Verified: ["Assigned"],
    Assigned: ["In progress", "Verified"],
    "In progress": ["Resolved", "Assigned"],
    Resolved: ["Verified", "Closed"],
    Closed: ["Verified"],
  };
  if (!allowed[from].includes(to))
    throw new Error(
      `Move from ${from} to ${allowed[from].join(" or ")} first.`,
    );
  if (
    ["Assigned", "In progress", "Resolved"].includes(to) &&
    department === "Unassigned"
  )
    throw new Error("Assign a department before advancing this report.");
  if (to === "Resolved" && note.trim().length < 12)
    throw new Error("Add a resolution summary of at least 12 characters.");
  if ((from === "Resolved" || from === "Closed") && note.trim().length < 12)
    throw new Error(
      "Explain why the report is being reopened (at least 12 characters).",
    );
}
