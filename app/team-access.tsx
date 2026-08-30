"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Brand } from "./components/ui";

export function TeamAccess({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "locked" | "ready">("loading");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const initialRequest = useRef<Promise<{ ok: boolean; authenticated?: boolean; error?: string }> | null>(null);

  useEffect(() => {
    let active = true;
    // Fragment secrets are never sent in HTTP requests or Referrer headers.
    if (!initialRequest.current) {
      const invite = new URLSearchParams(window.location.hash.slice(1)).get("access");
      if (invite) window.history.replaceState(null, "", window.location.pathname + window.location.search);
      initialRequest.current = fetch("/api/team-access", invite ? {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: invite }), cache: "no-store",
      } : { cache: "no-store" }).then(async (response) => ({ ...await response.json(), ok: response.ok }));
    }
    async function check() {
      try {
        const data = await initialRequest.current!;
        if (!active) return;
        setState(data.ok && data.authenticated ? "ready" : "locked");
        if (data.error) setError(data.error);
      } catch {
        if (active) { setState("locked"); setError("Could not check access. Check your connection and try again."); }
      }
    }
    void check();
    const expired = () => {
      setState("locked");
      setError("Your team session has expired. Reopen your invitation link to continue.");
    };
    window.addEventListener("reliable-snitch-access-expired", expired);
    return () => { active = false; window.removeEventListener("reliable-snitch-access-expired", expired); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/team-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }), cache: "no-store",
      });
      const data = await response.json() as { authenticated?: boolean; error?: string };
      if (!response.ok || !data.authenticated) throw new Error(data.error ?? "Could not open the team demo.");
      setCode(""); setState("ready");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open the team demo."); }
    finally { setBusy(false); }
  }

  if (state === "ready") return children;
  return (
    <div className="team-access">
      <div className="gov-utility"><div className="gov-container">Demonstration portal · Not an official government service</div></div>
      <header className="gov-masthead"><div className="gov-container team-access-brand"><Brand /></div></header>
      <main className="team-access-card" aria-busy={state === "loading" || busy}>
        <span className="team-access-label">RELIABLE SNITCH · TEAM DEMONSTRATION</span>
        <h1>{state === "loading" ? "Opening the portal" : "Team access"}</h1>
        {state === "loading" ? <p role="status">Checking your invitation…</p> : <>
          <p>Open the private invitation link shared by the project owner, or enter your team access code below. No installation or account is needed.</p>
          <form onSubmit={submit}>
            <label htmlFor="team-code">Team access code</label>
            <input id="team-code" type="password" value={code} onChange={(event) => setCode(event.target.value)} required maxLength={128} autoComplete="off" spellCheck={false} aria-describedby={error ? "team-error" : undefined} />
            {error && <p id="team-error" className="team-access-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Opening…" : "Open portal"}</button>
          </form>
          <p className="team-access-note">Everyone with the invitation can test reporting and dashboard actions. Share it only with your team and use non-sensitive demo content.</p>
        </>}
      </main>
    </div>
  );
}
