import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/i18n' // initialize i18next (side effect)
import { App } from '@/app/App'

// Theme + locale sync runs inside <BootstrapGate>, which holds the first paint
// until the Forge host context resolves (no light/English flash).

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
