import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/geist/latin-400.css'
import '@fontsource/geist/latin-500.css'
import '@fontsource/geist/latin-600.css'
import './index.css'
import App from './App'
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
