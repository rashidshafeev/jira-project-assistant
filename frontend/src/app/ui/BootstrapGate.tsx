import { type ReactNode, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { bootstrapForge } from '@/app/lib/forge-bootstrap'

/**
 * Holds the first paint until the Forge bootstrap resolves (host theme + user
 * locale), so the app never flashes the default light/English UI before flipping
 * to the real values. The theme mode is already seeded synchronously (see
 * `theme.store`), so the fallback spinner renders on the correct background —
 * the only visible state is a brief, correctly-themed spinner.
 *
 * In the mock preview `bootstrapForge` resolves immediately (no-op), so the gate
 * is effectively transparent.
 */
export function BootstrapGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    void bootstrapForge().finally(() => {
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  if (!ready) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  return <>{children}</>
}
