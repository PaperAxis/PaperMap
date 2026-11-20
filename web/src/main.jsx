import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './fonts.js';
import App from './App.jsx';
import './styles.css';
import { applyCachedAppearance } from './lib/appearance/index.js';
import { initNative } from './lib/native.js';
import { disableZoom } from './lib/noZoom.js';

applyCachedAppearance();
initNative();
disableZoom();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
