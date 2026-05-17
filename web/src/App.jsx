import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth.jsx';
import { NotificationProvider } from './lib/notifications.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Nav from './components/Nav.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MapView from './pages/MapView.jsx';
import Friends from './pages/Friends.jsx';
import Family from './pages/Family.jsx';
import Profile from './pages/Profile.jsx';
import Notifications from './pages/Notifications.jsx';
import UserProfile from './pages/UserProfile.jsx';

function Shell({ children }) {
  return (
    <div className="app">
      <main className="app-main">{children}</main>
      <Nav />
    </div>
  );
}

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Shell>{children}</Shell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Protected><MapView /></Protected>} />
          <Route path="/friends" element={<Protected><Friends /></Protected>} />
          <Route path="/family" element={<Protected><Family /></Protected>} />
          <Route
            path="/notifications"
            element={<Protected><Notifications /></Protected>}
          />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/users/:id" element={<Protected><UserProfile /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  );
}
