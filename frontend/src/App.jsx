import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthContext.jsx';
import { PageLoader, SiteLayout } from './components/SiteLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AdminTutorApplicationsPage from './pages/AdminTutorApplicationsPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import TutorProfilePage from './pages/TutorProfilePage.jsx';
import TutorApplicationPage from './pages/TutorApplicationPage.jsx';

export default function App() {
  const { user, loading } = useAuth();
  return <SiteLayout><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={loading ? <PageLoader /> : user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
    <Route path="/register" element={loading ? <PageLoader /> : user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="/tutor-profile" element={<ProtectedRoute><TutorProfilePage /></ProtectedRoute>} />
    <Route path="/tutor-application" element={<ProtectedRoute><TutorApplicationPage /></ProtectedRoute>} />
    <Route path="/admin/tutor-applications" element={<ProtectedRoute><AdminTutorApplicationsPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></SiteLayout>;
}
