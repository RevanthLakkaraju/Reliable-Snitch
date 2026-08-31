import { notFound } from "next/navigation";
import Portal from "../portal";
import AboutInformation from "../about-information";
const views = ["disruptions", "map", "departments", "activity", "about"];
export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  return {
    title: `${view === "map" ? "City view" : view.charAt(0).toUpperCase() + view.slice(1)} — Reliable Snitch`,
  };
}
export default async function ViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!views.includes(view)) notFound();
  if (view === "about") return <AboutInformation />;
  return <Portal view={view} />;
}
