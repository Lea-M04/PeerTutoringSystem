import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from './auth/AuthContext.jsx';
import App from './App.jsx';
import './styles.css';
import './profile.css';
import './discovery.css';
import './availability.css';
import './admin-users.css';
import './booking.css';
import './reviews.css';
import './navigation.css';
import './homepage.css';
import './notifications.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
