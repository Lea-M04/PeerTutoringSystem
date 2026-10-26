import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthContext.jsx';
import { PageLoader, SiteLayout } from './components/SiteLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AdminTutorApplicationsPage from './pages/AdminTutorApplicationsPage.jsx';
import AdminSubjectsPage from './pages/AdminSubjectsPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import TutorProfilePage from './pages/TutorProfilePage.jsx';
import TutorApplicationPage from './pages/TutorApplicationPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import TutorOfferingsPage from './pages/TutorOfferingsPage.jsx';
import TutorDirectoryPage from './pages/TutorDirectoryPage.jsx';
import TutorDirectoryProfilePage from './pages/TutorDirectoryProfilePage.jsx';
import TutorAvailabilityPage from './pages/TutorAvailabilityPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import AdminUserProfilePage from './pages/AdminUserProfilePage.jsx';
import StudentBookingsPage from './pages/StudentBookingsPage.jsx';
import StudentBookingDetailPage from './pages/StudentBookingDetailPage.jsx';
import TutorBookingsPage from './pages/TutorBookingsPage.jsx';
import TutorBookingDetailPage from './pages/TutorBookingDetailPage.jsx';
import TutorReviewsPage from './pages/TutorReviewsPage.jsx';
import AdminTutorOfferingsPage from './pages/AdminTutorOfferingsPage.jsx';
import AdminBookingsPage from './pages/AdminBookingsPage.jsx';
import AdminBookingDetailPage from './pages/AdminBookingDetailPage.jsx';

export default function App() {
  const { user, loading } = useAuth();
  return <SiteLayout><Routes>
    <Route path="/" element={loading ? <PageLoader /> : <LandingPage />} />
    <Route path="/login" element={loading ? <PageLoader /> : user ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route path="/register" element={loading ? <PageLoader /> : user ? <Navigate to="/" replace /> : <RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="/tutor-profile" element={<ProtectedRoute><TutorProfilePage /></ProtectedRoute>} />
    <Route path="/tutor-offerings" element={<ProtectedRoute><TutorOfferingsPage /></ProtectedRoute>} />
    <Route path="/tutor-availability" element={<ProtectedRoute><TutorAvailabilityPage /></ProtectedRoute>} />
    <Route path="/bookings" element={<ProtectedRoute><StudentBookingsPage /></ProtectedRoute>} />
    <Route path="/bookings/:bookingId" element={<ProtectedRoute><StudentBookingDetailPage /></ProtectedRoute>} />
    <Route path="/tutor-bookings" element={<ProtectedRoute><TutorBookingsPage /></ProtectedRoute>} />
    <Route path="/tutor-bookings/:bookingId" element={<ProtectedRoute><TutorBookingDetailPage /></ProtectedRoute>} />
    <Route path="/tutor-reviews" element={<ProtectedRoute><TutorReviewsPage /></ProtectedRoute>} />
    <Route path="/tutors" element={<ProtectedRoute><TutorDirectoryPage /></ProtectedRoute>} />
    <Route path="/tutors/:tutorProfileId" element={<ProtectedRoute><TutorDirectoryProfilePage /></ProtectedRoute>} />
    <Route path="/tutor-application" element={<ProtectedRoute><TutorApplicationPage /></ProtectedRoute>} />
    <Route path="/admin/tutor-applications" element={<ProtectedRoute><AdminTutorApplicationsPage /></ProtectedRoute>} />
    <Route path="/admin/subjects" element={<ProtectedRoute><AdminSubjectsPage /></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
    <Route path="/admin/users/:userId" element={<ProtectedRoute><AdminUserProfilePage /></ProtectedRoute>} />
    <Route path="/admin/tutor-offerings" element={<ProtectedRoute><AdminTutorOfferingsPage /></ProtectedRoute>} />
    <Route path="/admin/bookings" element={<ProtectedRoute><AdminBookingsPage /></ProtectedRoute>} />
    <Route path="/admin/bookings/:bookingId" element={<ProtectedRoute><AdminBookingDetailPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></SiteLayout>;
}
