"use client";
import { CitizenHeader } from "./components/ui";
import Link from "./components/navigation-link";
import { PHOTO_CREDITS } from "@/lib/demo-corpus";
export default function AboutInformation() {
  return (
    <div className="citizen-page">
      <CitizenHeader />
      <main id="citizen-main" className="about-services">
        <span className="eyebrow">PORTAL INFORMATION</span>
        <h1>Reliable Snitch · Civic services demonstration</h1>
        <section>
          <h2>One complaint, a recorded chain of action</h2>
          <p>
            Citizens register a titled complaint, check nearby issues,
            contribute missing photos and track their own submissions. Support
            is recorded once per account on the same reference—it does not
            create a new complaint.
          </p>
          <p>
            Invited officials sign in with individual credentials and a
            municipal access code. They review cases, allocate responsibility,
            coordinate provider contact and publish action-taken updates.
          </p>
        </section>
        <section>
          <h2>Processing and accountability</h2>
          <p>
            Reported → Verified → Assigned → In progress → Resolved → Closed.
            The complainant can answer clarification requests, confirm
            resolution or request reopening. Official transfers and register
            changes require a reason. Concurrent edits are checked before
            saving.
          </p>
          <p>
            Response targets and escalation flags are demonstration
            administration tools, not legal government deadlines or automatic
            notifications. Supervisors review the escalated queue manually.
          </p>
        </section>
        <section>
          <h2>Privacy and limitations</h2>
          <p>
            This is not an official government portal or an emergency service.
            Government employment and citizen identity are not independently
            verified. Only people given the municipal access code should create
            official demonstration accounts.
          </p>
          <p>
            Account passwords and access codes are not stored as readable text.
            Sessions expire and sign-out revokes the session. Account recovery
            is not connected; retain your prototype credentials. Use
            non-sensitive demonstration content only.
          </p>
          <p>
            Nearby summaries do not display citizen account identities or staff
            notes. Uploaded photos are reviewed before they appear to other
            citizens. Real facility lookup, AI image analysis, provider APIs,
            phone calls, email and SMS notifications are not connected. Map
            tiles require an internet connection; list views remain available if
            tiles fail.
          </p>
        </section>
        <section id="photo-credits">
          <h2>Indian photograph credits & demonstration corpus</h2>
          <p>
            These are real photographs, not AI-generated images. Complaint
            titles, scenario descriptions, ward labels, plotted locations and
            actions are fictional. A photograph is illustrative context and is
            not evidence of the incident or of an outage at the plotted
            location. Photographs of existing roads or lighting also do not
            prove a repair took place.
          </p>
          <p>
            Wikimedia originals or resized previews are hosted locally. No
            content edits were made; card layouts may crop the display. Each
            photograph remains under its stated licence. The photographers do
            not endorse this project.
          </p>
          <ul>
            {PHOTO_CREDITS.map((p) => (
              <li key={p.file}>
                <Link href={p.source} target="_blank" rel="noreferrer">
                  {p.title}
                </Link>{" "}
                — {p.author};{" "}
                <Link href={p.licenseUrl} target="_blank" rel="noreferrer">
                  {p.license}
                </Link>
                .{" "}
                <Link href={"/demo/" + p.file} target="_blank" rel="noreferrer">
                  View photograph
                </Link>
                .
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
