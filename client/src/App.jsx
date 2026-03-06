import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import WelcomePage from './pages/auth/WelcomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import OAuthCallbackPage from './pages/auth/OAuthCallbackPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import OnboardingPage from './pages/onboarding/OnboardingPage';
import ProfilePage from './pages/profile/ProfilePage';
import FeedPage from './pages/feed/FeedPage';
import UploadPage from './pages/upload/UploadPage';
import PostPage from './pages/post/PostPage';
import SettingsPage from './pages/settings/SettingsPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import ExplorePage from './pages/explore/ExplorePage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import EnquiriesPage from './pages/enquiries/EnquiriesPage';
import MessagesPage from './pages/messages/MessagesPage';
import AdminPage from './pages/admin/AdminPage';
import BoardsFeedPage from './pages/boards/BoardsFeedPage';
import BoardDetailPage from './pages/boards/BoardDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import './index.css';

function App() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', (event) => {
        const url = new URL(event.url);
        if (url.protocol === 'travelpod:' && url.host === 'callback') {
          // Push to React router handling
          window.location.href = `/auth/callback${url.search}`;
        }
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
              },
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/" element={<WelcomePage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/auth/callback" element={<OAuthCallbackPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />

            {/* Protected */}
            <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Posts & Profile */}
            <Route path="/post/:id" element={<PostPage />} />
            <Route path="/profile/:handle" element={<ProfilePage />} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/enquiries" element={<ProtectedRoute><EnquiriesPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
            <Route path="/explore" element={<ExplorePage />} />

            {/* Boards */}
            <Route path="/boards" element={<ProtectedRoute><BoardsFeedPage /></ProtectedRoute>} />
            <Route path="/boards/:id" element={<ProtectedRoute><BoardDetailPage /></ProtectedRoute>} />

            {/* Admin Console — web-only, standalone, NOT linked from the app UI */}
            <Route path="/admin" element={<AdminPage />} />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
