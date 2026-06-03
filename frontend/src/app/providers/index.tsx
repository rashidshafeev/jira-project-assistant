import type { ReactNode } from 'react'
import { AppThemeProvider } from './with-theme'
import { AppQueryProvider } from './with-query'

export { AppThemeProvider } from './with-theme'
export { AppQueryProvider } from './with-query'

/** Compose all app-wide providers (outermost first). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppQueryProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </AppQueryProvider>
  )
}
