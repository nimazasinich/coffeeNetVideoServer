import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { SmartCopyProvider } from './contexts/SmartCopyContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SmartCopyProvider>
      <App />
    </SmartCopyProvider>
  </StrictMode>
);
