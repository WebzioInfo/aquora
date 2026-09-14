import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle dynamic import / chunk load failures (common when new versions are deployed in production)
const handleChunkError = (errorMsg: string) => {
  const isChunkLoadFailed = 
    errorMsg.includes('Failed to fetch dynamically imported module') ||
    errorMsg.includes('Loading chunk') ||
    errorMsg.includes('ChunkLoadError');
    
  if (isChunkLoadFailed) {
    const hasReloaded = sessionStorage.getItem('chunk-failed-reload');
    if (!hasReloaded) {
      sessionStorage.setItem('chunk-failed-reload', 'true');
      window.location.reload();
    }
  }
};

window.addEventListener('error', (e) => {
  handleChunkError(e.message || '');
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const message = (reason && (reason.message || reason.toString())) || '';
  handleChunkError(message);
});

// Clear the reload flag after a successful app load
setTimeout(() => {
  sessionStorage.removeItem('chunk-failed-reload');
}, 5000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

