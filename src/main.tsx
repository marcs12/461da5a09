import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { startSync } from './lib/gistSync';
import { persistStorage } from './lib/store';
import './styles.css';

registerSW({ immediate: true });
startSync();
persistStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
