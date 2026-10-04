import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import {
  Layout,
  Protected,
  DashboardLayout,
  DashboardIndex,
} from "./components/Layout";
import { Loading } from "./components/UI";
import Home from "./pages/Home";
import "./styles.css";

const Auth = lazy(() => import("./pages/Auth"));
const Search = lazy(() => import("./pages/Search"));
const RoutesPage = lazy(() =>
  import("./pages/Search").then((m) => ({ default: m.RoutesPage })),
);
const Booking = lazy(() => import("./pages/Booking"));
const Ticket = lazy(() => import("./pages/Ticket"));
const Tracking = lazy(() => import("./pages/Tracking"));
const Journeys = lazy(() => import("./pages/Journeys"));
const Account = lazy(() => import("./pages/Account"));
const Notifications = lazy(() =>
  import("./pages/Account").then((m) => ({ default: m.Notifications })),
);
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Fleet = lazy(() => import("./pages/Fleet"));
const Staff = lazy(() =>
  import("./pages/Fleet").then((m) => ({ default: m.StaffPage })),
);
const Schedules = lazy(() => import("./pages/Schedules"));
const RoutesAdmin = lazy(() => import("./pages/RoutesAdmin"));
const Incidents = lazy(() => import("./pages/Incidents"));
const Support = lazy(() => import("./pages/Support"));
const Users = lazy(() => import("./pages/Users"));
const DriverPortal = lazy(() => import("./pages/DriverPortal"));
const ConductorPortal = lazy(() => import("./pages/ConductorPortal"));
const OperatorPortal = lazy(() => import("./pages/OperatorPortal"));
const AdminPortal = lazy(() => import("./pages/AdminPortal"));
const CustomerServicePortal = lazy(() => import("./pages/CustomerServicePortal"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));

function DutiesRedirect() {
  const { user } = useApp();
  if (user?.role === "CONDUCTOR") return <Navigate to="/conductor" replace />;
  return <Navigate to="/driver" replace />;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  state = { error: null as any };
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("ErrorBoundary caught error:", error, info);
  }
  render() {
    return this.state.error ? (
      <div className="container page empty" style={{ padding: "40px" }}>
        <h1>Something interrupted your journey.</h1>
        <p>Reload this page to reconnect to CityLink.</p>
        <pre style={{ textAlign: "left", background: "#1a1a2e", border: "1px solid #e94560", padding: "16px", borderRadius: "8px", maxWidth: "800px", margin: "20px auto", whiteSpace: "pre-wrap", color: "#ff8888", fontSize: "14px" }}>
          {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
        </pre>
        <button className="btn" onClick={() => location.reload()}>
          Reload page
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <Suspense
            fallback={
              <div className="container page">
                <Loading />
              </div>
            }
          >
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="search" element={<Search />} />
                <Route path="routes" element={<RoutesPage />} />
                <Route path="login" element={<Auth mode="login" />} />
                <Route path="register" element={<Auth mode="register" />} />
                <Route path="recover" element={<Auth mode="recover" />} />
                <Route path="driver" element={<DriverPortal />} />
                <Route path="conductor" element={<ConductorPortal />} />
                <Route path="operator" element={<OperatorPortal />} />
                <Route path="admin" element={<AdminPortal />} />
                <Route path="customer-service" element={<CustomerServicePortal />} />
                <Route path="customerservice" element={<CustomerServicePortal />} />
                <Route path="user-dashboard" element={<Navigate to="/my-bookings" replace />} />
                <Route element={<Protected />}>
                  <Route path="booking/:tripId" element={<Booking />} />
                  <Route path="ticket/:id" element={<Ticket />} />
                  <Route path="track" element={<Tracking />} />
                  <Route path="my-bookings" element={<Journeys />} />
                  <Route path="profile" element={<Account />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="support" element={<Support />} />
                </Route>
                <Route element={<Protected staff />}>
                  <Route path="dashboard" element={<DashboardLayout />}>
                    <Route index element={<DashboardIndex />} />
                    <Route element={<Protected permission="REPORTS" />}>
                      <Route path="overview" element={<Dashboard />} />
                      <Route path="reports" element={<Dashboard reports />} />
                    </Route>
                    <Route element={<Protected permission="SCHEDULES" />}>
                      <Route path="schedules" element={<Schedules />} />
                      <Route path="routes" element={<RoutesAdmin />} />
                    </Route>
                    <Route element={<Protected permission="FLEET" />}>
                      <Route path="fleet" element={<Fleet />} />
                      <Route path="staff" element={<Staff />} />
                    </Route>
                    <Route element={<Protected permission="BOOKINGS" />}>
                      <Route path="bookings" element={<Journeys admin />} />
                    </Route>
                    <Route element={<Protected permission="TRACKING" />}>
                      <Route path="tracking" element={<Tracking dashboard />} />
                    </Route>
                    <Route element={<Protected permission="SUPPORT" />}>
                      <Route
                        path="customer-service"
                        element={<Navigate to="/customerservice" replace />}
                      />
                    </Route>
                    <Route element={<Protected permission="USERS" />}>
                      <Route path="users" element={<Users />} />
                    </Route>
                    <Route path="duties" element={<DutiesRedirect />} />
                    <Route path="incidents" element={<Incidents />} />
                    <Route path="settings" element={<Account dashboard />} />
                  </Route>
                </Route>
                <Route
                  path="*"
                  element={
                    <div className="container page empty">
                      <h1>This route is off the map.</h1>
                      <Link to="/" className="btn">
                        Return home
                      </Link>
                    </div>
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
