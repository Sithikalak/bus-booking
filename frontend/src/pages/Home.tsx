import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Wifi,
  Navigation,
  Armchair,
  ShieldCheck,
  Ticket,
  Leaf,
  Route as RouteIcon,
  Sparkles,
} from "lucide-react";
import SearchForm from "../components/SearchForm";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { getRouteImage } from "../utils/routeImage";
import { useApi } from "../hooks/useApi";
import type { Route } from "../types";
import { ErrorBox } from "../components/UI";

export default function Home() {
  const { data: summary } = useApi<{
    activeRoutes: number;
    fleetSize: number;
    journeys: number;
    confirmedBookings: number;
  }>("/public/summary");
  const { data: routes, error, reload } = useApi<Route[]>("/routes");
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Handled by browser autoplay policy
        });
      }
    }
  }, []);
  useEffect(() => {
    if (location.hash)
      setTimeout(
        () =>
          document
            .getElementById(location.hash.slice(1))
            ?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
  }, [location.hash]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            e.target.classList.add("in-view");
          }
        }),
      { threshold: 0.05, rootMargin: "0px 0px 80px 0px" },
    );
    const elements = document.querySelectorAll(
      ".reveal, .scroll-reveal, .hero-copy, .search-section, .stats-strip, .section"
    );
    elements.forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, [routes]);
  return (
    <>
      <div className="hero-section">
        <div className="hero-bg-backdrop" aria-hidden="true">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            poster="/images/hero/hero-bg.webp"
            className="hero-bg-video"
          >
            <source src="/videos/colombo-city-night.mp4" type="video/mp4" />
            <source src="/videos/Interactive_Colombo_city_night_v%E2%80%A6_20261004002045.mp4" type="video/mp4" />
          </video>
          <div className="hero-bg-overlay" />
        </div>
        <section className="hero hero-centered">
          <div className="hero-grid" />
          <div className="hero-copy hero-copy-centered in-view scroll-reveal">
            <h1>
              <span className="hero-title-line-1">
                <span className="hero-word">MOVE</span>{" "}
                <span className="hero-word">THE</span>{" "}
                <span className="hero-word">CITY.</span>
              </span>{" "}
              <span className="hero-title-gradient-shimmer">REIMAGINED.</span>
            </h1>
            <p className="hero-subtitle">
              A smarter way to schedule, book and track every journey across Sri Lanka's expressway network.
            </p>

            {/* The 3 fields brought UP (compact & sleek) */}
            <div className="hero-benefits hero-benefits-centered">
              <span className="hero-benefit-chip hero-benefit-chip-lg">
                <ShieldCheck size={16} />
                <span>Secure bank-grade booking</span>
              </span>
              <span className="hero-benefit-chip hero-benefit-chip-lg">
                <Wifi size={16} />
                <span>High-speed connected travel</span>
              </span>
              <span className="hero-benefit-chip hero-benefit-chip-lg">
                <Sparkles size={16} />
                <span>Guaranteed seat allocation</span>
              </span>
            </div>

            {/* Premium CTA Buttons Below the 3 Fields */}
            <div className="hero-actions hero-actions-centered">
              <Link className="btn hero-btn-cta-premium" to="/search">
                <span>Book a journey</span>
                <ArrowUpRight size={17} className="btn-icon-elevate" />
              </Link>
              <Link className="btn hero-btn-secondary-premium" to="/routes">
                <span>Explore routes</span>
                <ArrowRight size={16} className="btn-icon-slide" />
              </Link>
            </div>

            {/* Stats Strip Container in the Hero Section Below the Two Buttons */}
            <div className="stats-strip hero-stats-strip in-view">
              {[
                ["activeRoutes", "Connected routes"],
                ["fleetSize", "Premium coaches"],
                ["journeys", "Upcoming journeys"],
                ["confirmedBookings", "Confirmed bookings"],
              ].map(([key, label]) => (
                <div key={key} className="stat-card hero-stat-card">
                  <strong>
                    <AnimatedCounter value={summary?.[key as keyof typeof summary]} />
                    <span className="stat-arrow"> ↗</span>
                  </strong>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-bottom">
            <span>01 / A BETTER WAY TO MOVE</span>
            <span>SCROLL TO EXPLORE ↓</span>
          </div>
        </section>
    </div>
      <section className="search-section container in-view scroll-reveal" id="transit-meter">
        <div className="meter-header">
          <div className="meter-identity">
            <div className="meter-name-badge">
              <span className="meter-pulse-dot" />
              <span className="meter-system-tag">EXPRESSWAY TRANSIT METER</span>
              <span className="meter-version-chip">LIVE DISPATCH</span>
            </div>
            <h2 className="meter-headline">
              Instant Expressway Route Finder <span>& Verified Seat Booking</span>
            </h2>
          </div>
          <div className="meter-telemetry">
            <div className="meter-telemetry-item">
              <span className="telemetry-label">NETWORK RADAR</span>
              <span className="telemetry-val"><span className="telemetry-dot" /> ACTIVE</span>
            </div>
            <div className="meter-telemetry-item">
              <span className="telemetry-label">FREQUENCY</span>
              <span className="telemetry-val">15 MIN EXPRESS</span>
            </div>
          </div>
        </div>
        <SearchForm />
        <div className="meter-footer-bar">
          <div className="meter-footer-features">
            <span className="meter-feature-item">
              <ShieldCheck size={14} /> Guaranteed Seat Allocation
            </span>
            <span className="meter-feature-sep">•</span>
            <span className="meter-feature-item">
              <Sparkles size={14} /> Live GPS Tracking Included
            </span>
            <span className="meter-feature-sep">•</span>
            <span className="meter-feature-item">
              <Ticket size={14} /> Instant Digital WhatsApp Ticket
            </span>
          </div>
          <div className="meter-express-routes">
            <span>E01 • E02 • E03 • E04 EXPRESSWAYS</span>
          </div>
        </div>
      </section>
      <section className="section container reveal revealed in-view">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BUILT AROUND YOUR JOURNEY</p>
            <h2>
              Less friction. <span>More possibility.</span>
            </h2>
          </div>
          <p>
            From the seat you choose to the moment you arrive.
            <br />
            Every detail, connected in one place.
          </p>
        </div>
        <div className="experience-grid">
          <Link to="/search" className="experience-card seating-card">
            <img
              src="/images/features/feature-booking-seats.jpg"
              alt="Intelligent Booking & Luxury Coach Seats"
              className="experience-card-bg"
              loading="lazy"
            />
            <div className="experience-card-scrim" />
            <div className="experience-card-content">
              <div className="card-top">
                <span>01 / INTELLIGENT BOOKING</span>
                <ArrowUpRight />
              </div>
              <div className="seat-preview" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className={i === 6 ? "selected" : ""}>
                    <span>
                      {Math.floor(i / 4) + 1}
                      {String.fromCharCode(65 + (i % 4))}
                    </span>
                  </div>
                ))}
              </div>
              <h3>Your seat. Your space.</h3>
              <p>
                Find your route and choose your perfect spot. A clear seat map, a
                simple checkout.
              </p>
              <span className="text-link">
                Find a journey <ArrowRight size={17} />
              </span>
            </div>
          </Link>
          <Link to="/track" className="experience-card tracking-card">
            <img
              src="/images/features/feature-live-tracking.jpg"
              alt="Connected Journeys & Live GPS Telemetry"
              className="experience-card-bg"
              loading="lazy"
            />
            <div className="experience-card-scrim" />
            <div className="experience-card-content">
              <div className="card-top">
                <span>02 / CONNECTED JOURNEYS</span>
                <ArrowUpRight />
              </div>
              <div className="tracking-preview" aria-hidden="true">
                <svg viewBox="0 0 500 200">
                  <path
                    d="M0 170L90 120 140 145 240 50 340 80 440 15 500 30"
                    className="preview-road"
                  />
                  <path
                    d="M90 120L140 145 240 50 340 80"
                    className="preview-route"
                  />
                  <circle cx="240" cy="50" r="8" />
                </svg>
                <div className="map-bus">
                  <Navigation size={23} />
                </div>
                <span>YOUR JOURNEY, IN VIEW</span>
              </div>
              <h3>Know what's ahead.</h3>
              <p>
                See your bus's last reported location, arrival estimate and
                schedule updates.
              </p>
              <span className="text-link">
                Track your bus <ArrowRight size={17} />
              </span>
            </div>
          </Link>
        </div>
      </section>
      <section className="section container reveal revealed in-view" id="routes">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR CITY. YOUR CONNECTION.</p>
            <h2>
              Good places. <span>Better connections.</span>
            </h2>
          </div>
          <Link className="btn secondary" to="/routes">
            All routes
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <ErrorBox message={error} retry={reload} />
        <div className="route-showcase">
          {routes?.slice(0, 3).map((r, i) => {
            const bgImage = getRouteImage(r);
            return (
              <Link
                className={"route-tile route-tile-with-img route-landscape-" + i}
                to={
                  "/search?origin=" +
                  encodeURIComponent(r.origin) +
                  "&destination=" +
                  encodeURIComponent(r.destination)
                }
                key={r.id}
              >
                <img
                  src={bgImage}
                  alt={`${r.origin} to ${r.destination}`}
                  className="route-tile-bg-img"
                  loading="lazy"
                />
                <div className="route-tile-scrim" />
                <span className="route-distance">
                  {r.distanceKm} KM / {r.stops.length} STOPS
                </span>
                <div className="route-tile-caption">
                  <small>{r.name}</small>
                  <h3>
                    {r.origin} <ArrowRight size={21} /> {r.destination}
                  </h3>
                  <span>
                    Find your connection <ArrowUpRight size={16} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="about-section section container reveal" id="about">
        <div>
          <p className="eyebrow">THOUGHTFULLY CONNECTED</p>
          <h2>
            Made for the way
            <br />
            <span>you move.</span>
          </h2>
          <p>
            CityLink brings passengers, crews and operations together. One
            connected platform for the journey ahead.
          </p>
          <Link className="text-link" to="/routes">
            Meet your next destination
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="why-grid">
          {[
            [
              Armchair,
              "Comfort comes first",
              "Premium coaches with a seat you can choose.",
            ],
            [
              Ticket,
              "Everything in your pocket",
              "Your booking, receipt and boarding pass, together.",
            ],
            [
              Navigation,
              "Stay in the know",
              "Arrival estimates and updates for your booked trip.",
            ],
            [
              RouteIcon,
              "Built for better operations",
              "Coordinated routes, fleet and crew assignments.",
            ],
          ].map(([Icon, title, desc], i) => {
            const I = Icon as typeof Leaf;
            return (
              <div key={i}>
                <I size={24} />
                <h3>{title as string}</h3>
                <p>{desc as string}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="cta-section container reveal">
        <div className="cta-bg-wrap" aria-hidden="true">
          <picture style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
            <source srcSet="/images/cta/cta-road.webp" type="image/webp" />
            <img
              src="/images/cta/cta-road.jpg"
              alt="Scenic road winding through Sri Lankan tea country"
              className="cta-bg-img"
              loading="lazy"
            />
          </picture>
          <div className="cta-bg-scrim" />
        </div>
        <div className="cta-content">
          <p className="eyebrow">THE ROAD IS CALLING</p>
          <h2>
            Your next chapter.
            <br />
            <span>One journey away.</span>
          </h2>
          <Link className="btn" to="/search">
            Let's get you there
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </section>
    </>
  );
}
