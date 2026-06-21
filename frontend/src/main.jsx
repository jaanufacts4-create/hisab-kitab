import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { unlockAudio } from './utils/sound.js'

// Browsers won't let any sound play until the page has seen at least one
// real tap/click — unlock it as early as possible so the very first
// notification tone (new order / order ready) isn't silently dropped.
window.addEventListener('pointerdown', unlockAudio, { once: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
