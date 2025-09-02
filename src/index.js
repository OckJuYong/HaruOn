// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import AppProvider from './context/AppProvider'; // Uncommented

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppProvider> {/* Uncommented */}
      <App />
    </AppProvider> {/* Uncommented */}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(); // Keep this if reportWebVitals is desired, otherwise remove.
