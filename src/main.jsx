import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Capacitor } from '@capacitor/core'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'

// Initialize GoogleAuth on native platforms
if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize({
    clientId: '267697346186-ortie4deqdkbqvrj4q6an18gv8idtnbj.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: true,
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
