import Tracker from "./tracker";
export const dynamic = "force-dynamic";
// Complaint details are fetched only after an authenticated, owner-scoped API check.
// Never embed another citizen's report in HTML, RSC payloads or link previews.
export const metadata = {
  title: "My complaint status — Reliable Snitch",
  description: "Sign in to track your own complaints and their public updates.",
  openGraph: { images: [] },
  twitter: { images: [] },
};
export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <Tracker initialCode={typeof code === "string" ? code : ""} />;
}
