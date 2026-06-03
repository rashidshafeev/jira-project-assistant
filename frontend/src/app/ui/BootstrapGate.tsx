import { type ReactNode, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { bootstrapForge } from '@/app/lib/forge-bootstrap'
import type { EntryContext } from '@/app/lib/entry-context'

/**
 * Holds the first paint until the Forge bootstrap resolves (host theme + user
 * locale + which view to render), so the app never flashes the default
 * light/English UI before flipping to the real values. The theme mode is already
 * seeded synchronously (see `theme.store`), so the fallback spinner renders on the
 * correct background — the only visible state is a brief, correctly-themed spinner.
 *
 * `children` is a render-prop given the resolved {@link EntryContext}, so the
 * caller branches between the full page and the single-issue panel.
 *
 * In the mock preview `bootstrapForge` resolves immediately (entry from the URL),
 * so the gate is effectively transparent.
 */
export function BootstrapGate({
  children,
}: {
  children: (entry: EntryContext) => ReactNode
}) {
  const [entry, setEntry] = useState<EntryContext | null>(null)

  useEffect(() => {
    let active = true
    void bootstrapForge().then((resolved) => {
      if (active) setEntry(resolved)
    })
    return () => {
      active = false
    }
  }, [])

  if (!entry) {
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

  return <>{children(entry)}</>
}
