# Reliable Snitch

**Spot it. Report it. Resolve it.**

A working, invitation-protected ideathon prototype for civic disruption management. It is not connected to a municipality or emergency service.

## The product

- `/report`: citizen photo upload, free-text description, GPS/manual pin/landmark location, and a saved reference.
- `/`: operations overview with shared metrics and recent activity.
- `/disruptions`: searchable report list, filters, status board, CSV export, and an editable report drawer.
- `/map`: mapped reports; demonstration facilities are explicitly fictional.
- `/departments`: workload and ownership across five mock departments.
- `/activity`: recorded changes and notes.
- `/track`: a read-only citizen view with public updates only.
- `/about`: a presentation walkthrough and clear prototype limitations.

## What is real, and what is simulated

Reports are persisted in D1. Uploaded images are stored in R2. The reporting, assignment, status changes, event history, public/internal notes, and tracking workflows are functional. Image uploads are re-encoded in the browser to remove original metadata. GPS is requested only after the citizen presses the location button.

Sample reports, facilities, municipal departments, and actions are illustrative. The category suggestion is a transparent keyword matcher, **not image AI**. Optional priority is assigned by staff; GPS does not determine urgency. The original photo and description remain available for human review.

This is the deployment-only copy of the blue government-style portal at commit `329e5ef`. The original localhost project and dated backup are unchanged. All existing portal screens, stylesheets, camera/GPS/photo processing, and workflows are preserved.

The hosted entry page is public, but every data, image, export, upload, and update API requires a signed team session. An invitation contains a cryptographically random 32-byte capability in its URL fragment (`#access=...`), which is removed before use and exchanged over HTTPS for a 24-hour HttpOnly, Secure, SameSite cookie. Only the SHA-256 hash of the invitation and an independent HMAC session key are stored as Sites runtime secrets. No account sign-in or installation is required. Public visitors without the invitation cannot load records, upload evidence, export data, or change statuses. A forged platform identity header is not accepted as team authorization.

Anyone who receives the invitation is a full demo operator and may submit reports and edit the shared mock dashboard. Share it only with teammates and use non-sensitive demonstration content. This is a team demonstration, not an anonymous public municipal service. To revoke an invitation and all sessions, rotate both runtime secrets and redeploy. Keep invitation links out of public repositories, screenshots, and public posts.

The hosted database contains the original 12 illustrative reports; localhost reports/photos are not copied. Verified facility coverage, individual staff/citizen roles for a real pilot, notifications, emergency dispatch, abuse controls, and a data-retention programme are still outside this prototype.

## Run locally

Use Node.js 22.13+ (Node 24 is used for the native TypeScript tests) and the project's pnpm version/lockfile.

```sh
pnpm install
pnpm dev
```

If pnpm requests native-dependency build approvals, review and approve the specific generated dependencies; do not disable the package-security policy. The committed allowlist contains the native dependencies used by the scaffold.

Local D1/R2 state is maintained under `.wrangler/` and is not included in the deployment. Twelve sample records are inserted idempotently. Submitted reports and edits survive page reloads and server restarts.

```sh
pnpm typecheck
pnpm lint
pnpm test
# With the local development server running:
pnpm test:integration
pnpm build
```

Integration tests refuse to run against a non-local URL. They create clearly labelled QA reports in local development storage only. The deployed workspace starts with the demonstration records, not local test data.

## Workflow and data integrity

`Reported → Verified → Assigned → In progress → Resolved`

A resolved report can be reopened to Verified with a reason. Assignment is required before active work. Resolution needs a written summary and supports an optional evidence photo. Optimistic revisions reject stale edits; D1 batches keep events and report updates atomic. A client-generated request identifier prevents duplicate submissions, including concurrent retries. Server queries use bound parameters.

Tables are declared in `db/schema.ts`; deployment migrations are in `drizzle/`. `lib/server.ts` owns database access and server-side validation. `lib/domain.ts` contains portable rules, statuses, category suggestions, and demonstration facility-distance calculations.

## A two-minute demo

1. Open the citizen portal on a phone; upload a non-sensitive image and describe the issue.
2. Choose a labelled demo location (or confirm a real location with permission), then submit.
3. Copy the new reference and open Disruptions on a second device using the team invitation.
4. Verify the report, assign a department, mark it In progress, then resolve it with a summary.
5. Open the reference in Track a report to show the public history. Add a private note in operations to demonstrate that it is excluded from the citizen view.

## Design and credits

The working portal uses a restrained civic-service presentation: navy-and-white
masthead, horizontal service navigation, a structured report register, plain
page headings, and bordered forms. `app/government.css` is the presentation
layer over the existing component styles. The name, data model, reporting and
camera workflows, and existing social-preview image are preserved. A prominent
demonstration notice makes clear that this is not an official government service.
The dated backup outside this project retains the previous design.

Lucide icons; Leaflet maps with OpenStreetMap attribution. The branded social card was generated with the built-in image-generation tool using the Reliable Snitch title and tagline, forest-green/ivory/lime palette, and abstract street-grid motif. No generated picture is presented as real evidence of a civic issue.

The existing hosted address and TE-prefixed report references are intentionally preserved so saved links and reports remain valid after rebranding.

## Camera reporting

“Take photo” opens a live camera dialog, prefers the rear camera, and never requests a microphone. Capture, review, retake, use-photo, and camera switching (when multiple cameras are available) are supported. Closing, capturing, switching, or choosing a file releases the current camera. Late permission responses cannot revive a closed camera.

If live camera permission is denied, the interface explains how to retry and offers the device’s native camera picker and ordinary photo upload. Live capture requires a supported browser, HTTPS (or localhost), camera hardware, and permission. An actual phone-camera check is still required before presenting on a particular phone; automated tests use synthetic camera streams/frames, and the test browser denied camera access.
