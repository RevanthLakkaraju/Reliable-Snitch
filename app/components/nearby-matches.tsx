"use client";
import { useEffect, useState } from "react";
import Link from "./navigation-link";
import { requestJson } from "@/lib/client";
import type { Report } from "@/lib/domain";
export default function NearbyMatches({
  point,
  category,
}: {
  point: { latitude: number; longitude: number } | null;
  category: string;
}) {
  const [matches, setMatches] = useState<Report[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (!point) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      requestJson<{ reports: Report[] }>(
        `/api/nearby?lat=${point.latitude}&lng=${point.longitude}&radius=750`,
        { signal: controller.signal },
      )
        .then((data) => {
          setMatches(
            data.reports
              .filter(
                (r) =>
                  r.category === category &&
                  !["Resolved", "Closed"].includes(r.status),
              )
              .slice(0, 4),
          );
          setError("");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [point, category]);
  if (!point)
    return (
      <div className="duplicate-check">
        Before submitting, check <Link href="/nearby">nearby complaints</Link>{" "}
        to see whether this issue is already registered.
      </div>
    );
  return (
    <div className="duplicate-check">
      <strong>Nearby issue check · within 750 m</strong>
      {error ? (
        <p>
          Could not check nearby reports. You may retry or continue if this is a
          different issue.
        </p>
      ) : matches.length ? (
        <>
          <p>
            These may describe the same issue. Matching titles alone do not
            prove a duplicate.
          </p>
          <ul>
            {matches.map((r) => (
              <li key={r.id}>
                {r.title} · {r.id} · {r.status}
              </li>
            ))}
          </ul>
          <p>
            Use the locality map to support an existing complaint or contribute
            its missing photo. You can still submit a distinct issue.
          </p>
        </>
      ) : (
        <p>
          No similar open complaints found in this category. This is a
          suggestion, not an automated duplicate decision.
        </p>
      )}
    </div>
  );
}
