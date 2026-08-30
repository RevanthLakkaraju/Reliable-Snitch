# Reliable Snitch

**Spot it. Report it. Resolve it.**

A working, private ideathon prototype for civic disruption management. It is not connected to a municipality or emergency service.

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

This deployment is owner-only. The same signed-in owner can demonstrate citizen and operator views on different devices. All authorised workspace users are demo operators. Public citizen/staff role separation, verified facility coverage, notifications, emergency dispatch, abuse controls, and a data-retention programme must be added before a real pilot. Do not change the site's access to public without designing those permissions.

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
3. Copy the new reference and open Disruptions on a second device signed in as the owner.
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
