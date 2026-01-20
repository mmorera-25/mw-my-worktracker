import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { applyTheme, getThemeMode } from './theme/applyTheme'
import { registerServiceWorker } from './pwa/registerServiceWorker'

applyTheme(getThemeMode())
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
