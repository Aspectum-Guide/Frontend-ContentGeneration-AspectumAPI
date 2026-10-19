import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { initErrorReporting } from './utils/errorReporting'
import { queryClient } from './api/queryClient'
import './index.css'
import { applyTheme } from './theme/themeBootstrap'

applyTheme()
initErrorReporting()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
