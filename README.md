# Reliable Snitch
A working civic-disruption management prototype in the existing blue government-portal style. **Not an official government service. Use non-sensitive demonstration content only.**

## Access and roles

- **Citizen:** create an individual username/password account; check nearby complaints; submit a titled report with a photo and location; track only complaints belonging to that account.
- **Municipal official:** create an individual account using the owner-issued municipal access code. Every subsequent sign-in requires the username, password **and access code**. Officials review and manage complaints; they cannot submit citizen reports.
- Registration with a code is a demonstration admission mechanism, not independent verification of government employment. Citizens are not verified against a government identity database.
- Passwords are salted and hashed with PBKDF2 and a server-side pepper. Session tokens are random, stored hashed, expire after eight hours, and are revoked on sign-out. Official sessions are also tied to the current municipal code hash.
- Role and ownership checks run on the server for reports, edits, photos, activity and export. A URL, a browser role choice or the former team invitation does not grant official access.
- Account recovery, production identity verification and a full security audit are not included. Keep your prototype credentials. Do not rotate the password pepper while retaining the existing accounts.

## Screens and workflows

| Citizen services | Municipal services |
| --- | --- |
| `/citizen`: personal register and optional private sample scenarios | `/`: overview and work queues |
| `/nearby`: GPS/manual/locality search, photos, titles, status | `/disruptions`: searchable register, status board, CSV export |
| `/report`: explicit title, free-text description, camera/upload, location | `/map`: mapped register with photos |
| `/track`: personal receipt, public history, clarification and resolution actions | `/departments`, `/activity`: workloads and audit history |
| `/about`: limitations and photograph credits | `/track`: official complaint lookup |

Normal navigation uses native same-tab links. The previous hosted client-router click problem is covered by regression tests.

**One complaint, one reference:** “I’m affected too” records at most one support per account and can be undone. It does not create another report. A missing photo can be contributed to the original complaint; an official must approve it before other citizens see it. The original author’s title and description are not overwritten. Nearby suggestions help people check existing complaints without automatically rejecting genuinely separate incidents.

**Internet/mobile complaints:** the reporter must select Airtel, Jio, BSNL, Vi, ACT Fibernet or Other (with a name). Officials record the selected provider’s ticket/reference and coordination stage. No phone calls, emails, SMS or provider API requests are sent.

**Action register:** locality/ward, responsible official/staff reference, department, response target, escalation flag, clarification request, provider coordination and photo review. Transfers and register changes require an action-taken note. Public and internal histories are separated.

`Reported → Verified → Assigned → In progress → Resolved → Closed`

The original complainant can answer a clarification, confirm a resolution, or reopen a resolved/closed case with a reason. Revision checks reject conflicting edits, and database batches keep changes and audit events together. Client-generated request IDs make retrying a report idempotent.

## Demonstration data and storage

D1 persists accounts, reports, support, review state and history. R2 stores uploaded photos. Local storage is under the ignored `.wrangler/` directory; hosted and local data/accounts are separate. Do not delete it if you need local records.

Sixteen shared fictional scenarios cover civic and network issues. “Load my demonstration complaints” adds two sample cases to that citizen account only: a clarification request and a simulated provider resolution. Reloading samples does not duplicate them. Existing pre-upgrade reports are preserved for municipal review; they are not automatically assigned to a newly registered citizen.

Nearby summaries intentionally disclose location, title, description and approved photos, but not citizen account identities, staff-only notes or pending photos. Use no sensitive information. Automatic re-encoding in the normal browser upload flow strips original photo metadata. Raw direct API uploads are not a substitute for a production image-sanitization service.

Real photographs from India are used only as illustrative context. Titles, incident descriptions, wards and mapped locations are fictional, and photographs do not prove an outage or repair. Files remain under their attributed licences:

- Gangaasoonu — [Roads deformed T munnekollala Bengaluru 2](https://commons.wikimedia.org/wiki/File:Roads_deformed_T_munnekollala_Bengaluru_2.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- melgupta — [Garbage Disposal Hyderabad 2005](https://commons.wikimedia.org/wiki/File:Garbage_Disposal_Hyderabad_2005.jpg), [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/).
- Oo7abhishekcool — [Drainage Problem in Navagarhi](https://commons.wikimedia.org/wiki/File:Drainage_Problem_in_Navagarhi.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- Adbh266 — [Gachibowli flyover](https://commons.wikimedia.org/wiki/File:Gachibowli_flyover.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

Original/resized Wikimedia files are hosted locally; no content edits were made. Cards may crop their display. Photographers do not endorse this project. Credits also appear at `/about#photo-credits`.

## Start a new local checkout

Use Node.js 24 and pnpm.

```sh
pnpm install
pnpm setup:local
pnpm dev
```

Open http://localhost:3000. Setup generates an ignored `.env` and `LOCAL-ACCESS.private.txt` containing the new local municipal code. It refuses to overwrite an existing `.env`. Existing configured working copies need only `pnpm dev`.

For a different port, change `SITE_ORIGIN` to that exact localhost origin and start with `pnpm dev --port PORT`. The municipal code of a new clone is local-only; the live website uses its separately configured code. Never upload private access files or `.env`.

The owner's existing **Start Working Version.cmd** launcher continues to open the configured working copy on port 3000. The dated backup is separate and is not changed by this upgrade.

## Verify

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Integration tests require the development server plus `TEST_BASE_URL` and the private `TEST_OFFICIAL_ACCESS_CODE` supplied as environment variables, then `pnpm test:integration`. They refuse non-local destinations and create clearly labelled QA data only locally. Do not run the obsolete pre-account `tests/api.test.mjs`; the active suite is `tests/roles-api.test.mjs`.

## Hosting and secrets

The existing Sites project is identified in `.openai/hosting.json`. Build and publish that project; do not create a duplicate site. The repository can stay private while the hosted sign-in screen remains publicly reachable.

Set runtime secrets `DEMO_SESSION_SECRET` (password pepper) and `OFFICIAL_ACCESS_CODE_HASH` (SHA-256 of the random owner-issued municipal code), plus `SITE_ORIGIN` set to the exact live origin. Code changes use versioned deployments and additive Drizzle migrations. The old `DEMO_ACCESS_CODE_HASH` invitation is no longer used.

Rotating only the municipal code hash revokes official sessions and requires the new code on their next sign-in. It does not change account passwords. Keep the raw code out of the site source, URL, browser bundle and public documentation.

## Camera, GPS and limitations

Take photo requests video only and prefers the rear camera. Capture, retake, use-photo, camera switching and native-file fallback are retained. Camera streams are stopped on closing/capture/switching, including late permission responses. Camera and GPS require permission, compatible hardware and HTTPS or localhost; test on the particular phone before presenting.

GPS is requested on the user's button press. A denied/unavailable location has manual-pin and landmark fallbacks. Map tiles need internet; the complaint list still works if tiles fail. The blue design is retained and the eye logo is replaced by a text wordmark.

This is not a production emergency or municipal service. Facility data, category keywords, deadlines, escalation and provider scenarios are explicitly illustrative; no automated danger decision or real-world dispatch occurs. Large-scale operations need independently verified identities, managed account recovery, stronger abuse/operational controls, privacy and retention policies, monitoring, accessibility testing and security review.
