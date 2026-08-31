"use client";
import Portal from "./portal";
import CitizenPortal from "./citizen/citizen-portal";
import { useViewer } from "./access-context";
export default function Home() {
  const viewer = useViewer();
  return viewer?.role === "official" ? <Portal /> : <CitizenPortal />;
}
