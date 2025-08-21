import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Intro from './pages/Intro';
import Home from './pages/Home';
import History from './pages/History';
import Chat from './pages/Chat';
import Profile from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/intro" replace />} />
        <Route path="/intro" element={<Intro />} />
        <Route path="/home" element={<Home />} />
        <Route path="/history" element={<History />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/intro" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
