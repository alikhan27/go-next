import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import JoinQueue from "./pages/JoinQueue";
import TicketStatus from "./pages/TicketStatus";
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

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/dashboard/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/join/:businessId" element={<JoinQueue />} />
            <Route path="/ticket/:ticketId" element={<TicketStatus />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
