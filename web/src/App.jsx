import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './lib/settings.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { NotificationProvider } from './lib/notifications.jsx';
import { MessagesProvider } from './lib/messages.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Nav from './components/Nav.jsx';

// Sayfalar tembel yuklenir — baslangic paketi kucuk kalir (ozellikle harita
// kutuphanesi yalnizca harita acilinca indirilir).
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const MapView = lazy(() => import('./pages/MapView.jsx'));
const Friends = lazy(() => import('./pages/Friends.jsx'));
const Family = lazy(() => import('./pages/Family.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const UserProfile = lazy(() => import('./pages/UserProfile.jsx'));
const Messages = lazy(() => import('./pages/Messages.jsx'));
const ChatView = lazy(() => import('./pages/ChatView.jsx'));
const NewGroup = lazy(() => import('./pages/NewGroup.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

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
    <SettingsProvider>
      <AuthProvider>
        <NotificationProvider>
          <MessagesProvider>
            <Suspense fallback={<div className="center">Yükleniyor…</div>}>
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
              <Route
                path="/users/:id"
                element={<Protected><UserProfile /></Protected>}
              />
              <Route path="/messages" element={<Protected><Messages /></Protected>} />
              <Route
                path="/messages/new-group"
                element={<Protected><NewGroup /></Protected>}
              />
              <Route
                path="/messages/:id"
                element={<Protected><ChatView /></Protected>}
              />
              <Route path="/admin" element={<Protected><Admin /></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </MessagesProvider>
        </NotificationProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
