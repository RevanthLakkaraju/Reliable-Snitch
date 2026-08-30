"use client";
import Link from "next/link";

import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Map,
  Building2,
  Activity,
  ArrowUpRight,
  Search,
  Menu,
  X,
  Plus,
  LifeBuoy,
  Route,
  Lightbulb,
  Trash2,
  Droplets,
  Trees,
  HelpCircle,
  Check,
  Clock,
  ChevronRight,
} from "lucide-react";
import { statusClass, type Category, type Status } from "@/lib/domain";
export function Brand() {
  return (
    <Link className="brand" href="/">
      <span className="eye-mark">
        <i />
      </span>
      <span>
        third eye<span className="brand-caption">CIVIC OPERATIONS</span>
      </span>
    </Link>
  );
}
const navigation = [
  { id: "overview", href: "/", label: "Overview", Icon: LayoutDashboard },
  {
    id: "disruptions",
    href: "/disruptions",
    label: "Disruptions",
    Icon: ClipboardList,
  },
  { id: "map", href: "/map", label: "City view", Icon: Map },
  {
    id: "departments",
    href: "/departments",
    label: "Departments",
    Icon: Building2,
  },
  { id: "activity", href: "/activity", label: "Activity log", Icon: Activity },
];
export function Shell({
  active,
  children,
  search,
  onSearch,
}: {
  active: string;
  children: ReactNode;
  search?: string;
  onSearch?: (value: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="app-shell">
      <Link href="#main" className="skip-link">
        Skip to content
      </Link>
      {menu && (
        <button
          className="menu-backdrop"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={"sidebar " + (menu ? "mobile-open" : "")}>
        <Brand />
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, href, label, Icon }) => (
            <Link
              key={id}
              href={href}
              className={"nav-item " + (active === id ? "active" : "")}
              aria-current={active === id ? "page" : undefined}
            >
              <Icon size={17} />
              {label}
              {id === "disruptions" && (
                <ChevronRight size={14} className="nav-arrow" />
              )}
            </Link>
          ))}
        </nav>
        <div className="nav-divider" />
        <Link href="/report" className="nav-item">
          <ArrowUpRight size={17} />
          Citizen portal
        </Link>
        <Link href="/track" className="nav-item">
          <Search size={17} />
          Track a report
        </Link>
        <Link
          href="/about"
          className={"nav-item " + (active === "about" ? "active" : "")}
        >
          <LifeBuoy size={17} />
          About the prototype
        </Link>
        <div className="sidebar-bottom">
          <span className="live-dot" /> Private demo workspace
          <p>
            Better streets start with
            <br />
            someone paying attention.
          </p>
          <div className="operator">
            <span className="avatar">TE</span>
            <div>
              Demo operations team<small>Workspace operator</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={12} />
            <strong>
              {navigation.find((n) => n.id === active)?.label ??
                "About the prototype"}
            </strong>
          </div>
          <div className="topbar-actions">
            {onSearch && (
              <label className="search-box top-search">
                <Search size={15} />
                <input
                  aria-label="Search reports"
                  placeholder="Search reports…"
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                />
                <span className="search-hint">⌕</span>
              </label>
            )}
            <span className="workspace-pill">
              <span className="live-dot" /> Ideathon prototype
            </span>
            <span className="avatar small">TE</span>
          </div>
        </header>
        <main className="main-content" id="main">
          {children}
          <footer className="page-footer">
            THIRD EYE <span>Spot it. Report it. Resolve it.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export function CitizenHeader() {
  return (
    <header className="citizen-header">
      <Brand />
      <nav>
        <Link href="/track">Track a report</Link>
        <Link className="button" href="/">
          Operations portal <ArrowUpRight size={14} />
        </Link>
      </nav>
    </header>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={"status " + statusClass(status)}>
      <span className="status-dot" />
      {status}
    </span>
  );
}
export function CategoryIcon({
  category,
  size = 18,
}: {
  category: Category;
  size?: number;
}) {
  const Icon =
    category === "Roads & footpaths"
      ? Route
      : category === "Street lighting"
        ? Lightbulb
        : category === "Waste & sanitation"
          ? Trash2
          : category === "Water & drainage"
            ? Droplets
            : category === "Parks & public spaces"
              ? Trees
              : HelpCircle;
  return (
    <span
      className={
        "category-icon cat-" +
        (category === "Street lighting"
          ? "lighting"
          : category === "Water & drainage"
            ? "water"
            : category === "Waste & sanitation"
              ? "waste"
              : "roads")
      }
    >
      <Icon size={size} />
    </span>
  );
}
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <ClipboardList size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Stepper({ status }: { status: Status }) {
  const stages: [
    "Reported",
    "Verified",
    "Assigned",
    "In progress",
    "Resolved",
  ] = ["Reported", "Verified", "Assigned", "In progress", "Resolved"];
  const current = stages.indexOf(status);
  return (
    <ol className="stepper">
      {stages.map((step, index) => (
        <li
          key={step}
          className={
            index < current ? "done" : index === current ? "current" : ""
          }
        >
          <span>
            {index < current ? (
              <Check size={12} />
            ) : index === current ? (
              <Clock size={12} />
            ) : (
              index + 1
            )}
          </span>
          <small>{step}</small>
        </li>
      ))}
    </ol>
  );
}
export function ReportButton() {
  return (
    <Link href="/report" className="button primary">
      <Plus size={16} />
      Report a disruption
    </Link>
  );
}
