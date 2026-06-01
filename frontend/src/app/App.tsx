import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { withTheme } from '@/app/providers'
import { useSessionStore } from '@/app/model/session.store'

function Root() {
  const selectedProjectKey = useSessionStore((s) => s.selectedProjectKey)
  const setSelectedProjectKey = useSessionStore((s) => s.setSelectedProjectKey)

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Jira Project Assistant
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Stack check — React + TypeScript (strict) + MUI + Zustand, FSD layout.
      </Typography>
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          onClick={() => setSelectedProjectKey(selectedProjectKey ? null : 'DEMO')}
        >
          {selectedProjectKey ? 'Clear project' : 'Select DEMO project'}
        </Button>
        <Typography variant="body2">
          Selected project: <strong>{selectedProjectKey ?? 'none'}</strong>
        </Typography>
      </Box>
    </Container>
  )
}

export function App() {
  return withTheme(<Root />)
}
