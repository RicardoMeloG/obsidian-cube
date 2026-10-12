import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter, self-hosted (ADR 006): every visitor gets the metrics the layout
// check measured. The browser fetches only the subsets the page uses.
import '@fontsource-variable/inter/wght.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
