import Link from "./components/navigation-link";
import { CitizenHeader } from "./components/ui";
export default function NotFound() {
  return (
    <>
      <CitizenHeader />
      <main className="not-found">
        <div className="eyebrow">404 · A SMALL DETOUR</div>
        <h1>This street leads nowhere.</h1>
        <p>
          The page may have moved, but your reports are still in the portal.
        </p>
        <Link className="button primary" href="/">
          Back to the workspace
        </Link>
      </main>
    </>
  );
}
