import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Outlets from "./pages/Outlets";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import WhatsNew from "./pages/WhatsNew";
import JoinQueue from "./pages/JoinQueue";
import TicketStatus from "./pages/TicketStatus";
import Display from "./pages/Display";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";

function Protected({ children }) {
  const { auth } = useAuth();
  if (auth === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500" data-testid="auth-loading">
        Loading…
      </div>
    );
  }
  if (!auth || auth === false) return <Navigate to="/login" replace />;
  return children;
}

function SuperAdminOnly({ children }) {
  const { auth } = useAuth();
  if (auth === null) {
    return <div className="min-h-screen flex items-center justify-center text-stone-500">Loading…</div>;
  }
  if (!auth || auth === false) return <Navigate to="/login" replace />;
  if (auth.user?.role !== "super_admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function PostLoginRedirect() {
  const { auth } = useAuth();
  if (auth === null) {
    return <div className="min-h-screen flex items-center justify-center text-stone-500">Loading…</div>;
  }
  if (!auth || auth === false) return <Navigate to="/login" replace />;
  if (auth.user?.role === "super_admin") return <Navigate to="/admin" replace />;
  const list = auth.businesses || [];
  if (list.length === 0) return <Navigate to="/dashboard/outlets" replace />;
  return <Navigate to={`/dashboard/${list[0].id}`} replace />;
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/dashboard" element={<PostLoginRedirect />} />
            <Route path="/dashboard/outlets" element={<Protected><Outlets /></Protected>} />
            <Route path="/dashboard/whats-new" element={<Protected><WhatsNew /></Protected>} />
            <Route path="/dashboard/:businessId" element={<Protected><Dashboard /></Protected>} />
            <Route path="/dashboard/:businessId/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/dashboard/:businessId/analytics" element={<Protected><Analytics /></Protected>} />

            <Route path="/admin" element={<SuperAdminOnly><AdminPanel /></SuperAdminOnly>} />

            <Route path="/join/:businessId" element={<JoinQueue />} />
            <Route path="/ticket/:ticketId" element={<TicketStatus />} />
            <Route path="/display/:businessId" element={<Display />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
