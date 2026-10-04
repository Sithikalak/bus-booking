import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowRight,
  BusFront,
  LoaderCircle,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
export const money = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(n);
export const dateTime = (s: string) =>
  new Date(
    s.endsWith("Z")
      ? s
      : s.includes("T")
        ? s + "+05:30"
        : s + "T00:00:00+05:30",
  ).toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const clockTime = (s: string) =>
  new Date(s.endsWith("Z") ? s : s + "+05:30").toLocaleTimeString("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
  });
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="CityLink Express home">
      <svg width="34" height="28" viewBox="0 0 38 32" fill="none" aria-hidden="true" className="brand-logo-svg">
        <defs>
          <linearGradient id="brandCyanGrad" x1="0%" y1="0%" x2="100%" y2="85%">
            <stop offset="0%" stopColor="#38e1ff" />
            <stop offset="50%" stopColor="#00d2ff" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#00d2ff" floodOpacity="0.4" />
          </filter>
        </defs>
        <path
          d="M7 4.5h27c1.8 0 3 1.8 2.4 3.4l-2.6 6.3c-.4.9-1.2 1.5-2.2 1.5H15l-1.9 3.8h13.2c1.7 0 2.9 1.7 2.3 3.3l-1.9 4.8c-.4 1-1.4 1.7-2.5 1.7H5.5c-2.2 0-3.8-2.2-3-4.2L7 4.5z"
          fill="url(#brandCyanGrad)"
          filter="url(#cyanGlow)"
        />
      </svg>
      <span className="brand-text">
        <strong className="brand-main">CITYLINK</strong>
        <small className="brand-sub">EXPRESS</small>
      </span>
    </Link>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={"badge " + status.toLowerCase().replaceAll(" ", "_")}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
export function Loading() {
  return (
    <div className="skeletons" aria-label="Loading">
      <div />
      <div />
      <div />
    </div>
  );
}
export function Spinner() {
  return <LoaderCircle className="spin" size={17} />;
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = "YOUR NEXT JOURNEY STARTS HERE",
  message = "Find a route, choose your seat and make it yours.",
  to = "/search",
  action = "Find a journey",
}: {
  title?: string;
  message?: string;
  to?: string;
  action?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <BusFront size={34} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action && (
        <Link className="btn secondary" to={to}>
          {action}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Pagination({
  page,
  size,
  total,
  onChange,
}: {
  page: number;
  size: number;
  total: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${page * size + 1}–${Math.min((page + 1) * size, total)} of ${total}`
          : "0 results"}
      </span>
      <button
        className="icon-button"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        className="icon-button"
        disabled={(page + 1) * size >= total}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
