import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { PrivacyPage } from './components/PrivacyPage'
import './styles/globals.css'
import './styles/home.css'
import './styles/calendar.css'
import './styles/auth.css'
import './styles/landing.css'
import './styles/tutorial.css'
import './styles/suggestions.css'
import './styles/privacy.css'
import 'katex/dist/katex.min.css'

const isPrivacy = window.location.pathname === '/privacidade'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPrivacy ? <PrivacyPage /> : <App />}
  </React.StrictMode>
)
