import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import NewOrder from './pages/NewOrder';
import OrderDetail from './pages/OrderDetail';
import Khata from './pages/Khata';
import Expenses from './pages/Expenses';
import Menu from './pages/Menu';
import Staff from './pages/Staff';
import AddItems from './pages/AddItems';
import Analytics from './pages/Analytics';
import Plans from './pages/Plans';
import Admin from './pages/Admin';
import ExpiredScreen from './pages/ExpiredScreen';
import PublicMenu from './pages/PublicMenu';
import PublicOrderStatus from './pages/PublicOrderStatus';

// `allowExpired` lets a couple of pages (Plans, so they can see what to
// upgrade to) stay reachable even after the trial has expired — everything
// else behind ProtectedRoute gets fully locked out.
function ProtectedRoute({ children, allowExpired = false }) {
  const { isLoggedIn, plan } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (plan === 'expired' && !allowExpired) return <ExpiredScreen />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/orders/new" element={<ProtectedRoute><NewOrder /></ProtectedRoute>} />
      <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
      <Route path="/orders/:id/add-items" element={<ProtectedRoute><AddItems /></ProtectedRoute>} />
      <Route path="/khata" element={<ProtectedRoute><Khata /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/plans" element={<ProtectedRoute allowExpired><Plans /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowExpired><Admin /></ProtectedRoute>} />

      {/* Customer-facing QR self-order — deliberately NOT behind
          ProtectedRoute, no staff login involved. Gated server-side per
          restaurant on plan='pro'. */}
      <Route path="/order/:qrToken/:tableNo" element={<PublicMenu />} />
      <Route path="/order/:qrToken/:tableNo/status/:orderId" element={<PublicOrderStatus />} />
    </Routes>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </LangProvider>
  );
}
