"use client";
import Link from "next/link";

import { useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
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
      <span className="brand-name">
        Reliable Snitch
        <span className="brand-caption">CIVIC SERVICES MANAGEMENT PORTAL</span>
      </span>
    </Link>
  );
}
const navigation = [
  { id: "overview", href: "/", label: "Dashboard", Icon: LayoutDashboard },
  {
    id: "disruptions",
    href: "/disruptions",
    label: "Disruption register",
    Icon: ClipboardList,
  },
  { id: "map", href: "/map", label: "Location map", Icon: Map },
  {
    id: "departments",
    href: "/departments",
    label: "Departments",
    Icon: Building2,
  },
  { id: "activity", href: "/activity", label: "Activity log", Icon: Activity },
  {
    id: "about",
    href: "/about",
    label: "Portal information",
    Icon: HelpCircle,
  },
];
function PortalMasthead() {
  return (
    <>
      <div className="gov-utility">
        <div className="gov-container">
          <span>Demonstration portal · Not an official government service</span>
          <Link href="/about">
            About this prototype <ChevronRight size={12} />
          </Link>
        </div>
      </div>
      <header className="gov-masthead">
        <div className="gov-container gov-masthead-inner">
          <Brand />
          <div className="gov-service-label">
            <Building2 size={28} aria-hidden="true" />
            <div>
              <strong>Civic Disruption Management</strong>
              <span>Report registration &amp; department coordination</span>
            </div>
          </div>
          <div className="gov-citizen-links">
            <Link href="/report">
              Submit a report <ArrowUpRight size={14} />
            </Link>
            <Link href="/track">
              Track report status <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
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
  const menuButton = useRef<HTMLButtonElement>(null);
  return (
    <div className="app-shell gov-shell">
      <Link href="#main" className="skip-link">
        Skip to content
      </Link>
      <PortalMasthead />
      <div className="gov-navigation-band">
        <div className="gov-container">
          <button
            ref={menuButton}
            className="gov-menu-toggle"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="portal-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={20} /> : <Menu size={20} />}
            Portal navigation
          </button>
          <nav
            id="portal-navigation"
            className={"gov-navigation " + (menu ? "is-open" : "")}
            aria-label="Main navigation"
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a"))
                setMenu(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setMenu(false);
                menuButton.current?.focus();
              }
            }}
          >
            {navigation.map(({ id, href, label, Icon }) => (
              <Link
                key={id}
                href={href}
                className={active === id ? "active" : undefined}
                aria-current={active === id ? "page" : undefined}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="main-shell">
        <div className="gov-container gov-page-toolbar">
          <div className="breadcrumb">
            <Link href="/">Operations portal</Link>
            <ChevronRight size={12} />
            <strong>
              {navigation.find((n) => n.id === active)?.label ??
                "Portal information"}
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
              </label>
            )}
            <span className="gov-operator-label">Demo operations team</span>
          </div>
        </div>
        <main className="main-content" id="main">
          {children}
          <footer className="page-footer">
            <div>
              <strong>Reliable Snitch</strong>
              <span>Civic Services Management Portal</span>
            </div>
            <p>
              Demonstration only. Reports do not notify a municipal or emergency
              service.
            </p>
            <Link href="/about">Portal information</Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
export function CitizenHeader() {
  const pathname = usePathname();
  return (
    <>
      <Link href="#citizen-main" className="skip-link">
        Skip to content
      </Link>
      <PortalMasthead />
      <div className="gov-navigation-band">
        <nav
          className="gov-container gov-citizen-navigation"
          aria-label="Citizen services"
        >
          {[
            ["/report", "Submit a report"],
            ["/track", "Track report status"],
            ["/", "Operations dashboard"],
            ["/about", "Portal information"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>
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
