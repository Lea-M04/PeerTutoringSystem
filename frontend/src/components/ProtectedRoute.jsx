import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageLoader } from './SiteLayout.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
