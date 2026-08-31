"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Brand } from "./components/ui";
import Link from "./components/navigation-link";
import { AccessContext, type Viewer } from "./access-context";
import { usePathname } from "next/navigation";
export function TeamAccess({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<Viewer | null>(null),
    [loading, setLoading] = useState(true),
    [role, setRole] = useState<"citizen" | "official">("citizen"),
    [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    // Old team invitation links never confer an official role.
    if (window.location.hash.startsWith("#access="))
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    fetch("/api/team-access", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ user?: Viewer }>)
      .then((data) => {
        if (active) {
          setViewer(data.user ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError("Could not check sign-in. Refresh or try again.");
          setLoading(false);
        }
      });
    const expired = () => {
      setViewer(null);
      setError("Your session has expired. Please sign in again.");
    };
    window.addEventListener("reliable-snitch-access-expired", expired);
    return () => {
      active = false;
      window.removeEventListener("reliable-snitch-access-expired", expired);
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/team-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: register ? "register" : "login",
          role,
          username: fields.get("username"),
          password: fields.get("password"),
          name: fields.get("name"),
          accessCode: fields.get("accessCode"),
        }),
      });
      const data = (await response.json()) as { error?: string; user: Viewer };
      if (!response.ok) throw new Error(data.error ?? "Could not sign in.");
      // A fresh document also resets old role-specific form state.
      window.location.assign(data.user.role === "official" ? "/" : "/citizen");
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }
  if (viewer) {
    const staffPages = ["/disruptions", "/map", "/departments", "/activity"];
    const citizenPages = ["/citizen", "/nearby", "/report"];
    const blocked =
      viewer.role === "citizen"
        ? staffPages.includes(pathname)
        : citizenPages.includes(pathname);
    return (
      <AccessContext.Provider value={viewer}>
        {blocked ? (
          <div className="access-denied">
            <Brand />
            <h1>This service belongs to the other portal</h1>
            <p>
              Your account permissions have not changed. Use the services
              assigned to your role.
            </p>
            <Link
              href={viewer.role === "official" ? "/" : "/citizen"}
              className="button primary"
            >
              Return to my portal
            </Link>
            <SignOut />
          </div>
        ) : (
          children
        )}
      </AccessContext.Provider>
    );
  }
  return (
    <div className="team-access">
      <div className="gov-utility">
        <div className="gov-container">
          Demonstration portal · Not an official government service
        </div>
      </div>
      <header className="gov-masthead">
        <div className="gov-container team-access-brand">
          <Brand />
        </div>
      </header>
      <main className="access-layout">
        <section className="access-intro">
          <span className="eyebrow">CIVIC SERVICES · SINGLE WINDOW</span>
          <h1>Complaint registration & municipal coordination</h1>
          <p>
            Choose your portal to report local issues or manage departmental
            action.
          </p>
          <div className="access-service">
            <strong>Citizen services</strong>
            <p>
              Check nearby complaints, report an issue, add missing evidence and
              track your own cases.
            </p>
          </div>
          <div className="access-service">
            <strong>Municipal services</strong>
            <p>
              Review the register, coordinate departments and service providers,
              and record action taken.
            </p>
          </div>
          <p className="field-hint">
            Ideathon prototype. Use non-sensitive demonstration information. No
            government identity verification or emergency dispatch is connected.
          </p>
        </section>
        <section className="team-access-card" aria-busy={loading || busy}>
          <span className="team-access-label">SECURE PORTAL ACCESS</span>
          {loading ? (
            <>
              <h2>Opening the portal</h2>
              <p role="status">Checking your session…</p>
            </>
          ) : (
            <>
              <div
                className="access-tabs"
                role="group"
                aria-label="Portal selection"
              >
                <button
                  type="button"
                  aria-pressed={role === "citizen"}
                  onClick={() => {
                    setRole("citizen");
                    setError("");
                  }}
                >
                  Citizen
                </button>
                <button
                  type="button"
                  aria-pressed={role === "official"}
                  onClick={() => {
                    setRole("official");
                    setError("");
                  }}
                >
                  Municipal official
                </button>
              </div>
              <h2>
                {register ? "Create" : "Sign in to"} your{" "}
                {role === "citizen" ? "citizen" : "official"} account
              </h2>
              <p>
                {role === "official"
                  ? "Your individual credentials AND the owner-issued municipal access code are required every time."
                  : "Your account keeps your complaints separate from other citizens’ records."}
              </p>
              <form onSubmit={submit} key={role + "-" + register}>
                {register && (
                  <label>
                    Display name
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                    />
                  </label>
                )}
                <label>
                  Username
                  <input
                    name="username"
                    required
                    minLength={3}
                    maxLength={40}
                    pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,39}"
                    autoComplete="username"
                    spellCheck={false}
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                  />
                </label>
                <small>
                  At least 12 characters. Use a unique prototype password;
                  account recovery is not connected.
                </small>
                {role === "official" && (
                  <label>
                    Municipal access code
                    <input
                      name="accessCode"
                      type="password"
                      required
                      maxLength={128}
                      autoComplete="off"
                    />
                    <small>
                      Ask the project owner for this code. Do not share it in
                      the citizen group.
                    </small>
                  </label>
                )}
                {error && (
                  <p className="team-access-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="button primary" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : register
                      ? "Create account & continue"
                      : "Sign in"}
                </button>
              </form>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setRegister(!register);
                  setError("");
                }}
              >
                {register
                  ? "Already registered? Sign in"
                  : role === "official"
                    ? "Have an official invitation? Create account"
                    : "New citizen? Create account"}
              </button>
              <p className="team-access-note">
                {role === "official"
                  ? "The code authorizes demonstration access; it does not verify government employment."
                  : "Only complaint information intended for public viewing appears on the locality map."}
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
export function SignOut() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <span className="signout">
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/team-access", { method: "DELETE" });
            if (!r.ok) throw new Error("Could not sign out. Please retry.");
            window.location.assign("/");
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
