import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppProvider';

// Page Imports
import Intro from './pages/Intro';
import Home from './pages/Home';
import History from './pages/History';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Login from "./User/Login/Login";
import FindPw from "./User/FindPw/FindPw";
import Signup from "./User/SignUp/Signup";

// A wrapper for routes that require authentication
function ProtectedRoute({ children }) {
  const { user, loading } = useApp();

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// A wrapper for public routes that shouldn't be accessed when logged in
function PublicRoute({ children }) {
    const { user, loading } = useApp();

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
    }

    if (user) {
        return <Navigate to="/home" replace />;
    }

    return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/intro" replace />} />
        <Route path="/intro" element={<Intro />} />

        {/* Public routes restricted for logged-in users */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/findpw" element={<PublicRoute><FindPw /></PublicRoute>} />

        {/* Protected Routes */}
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/intro" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
