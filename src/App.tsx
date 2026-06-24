import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, Typography, Button } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { useSettingsStore } from './store/settingsStore';
import { useQueue } from './hooks/useQueue';
import { IS_TAURI } from './services/tauriApi';
import AppLayout from './components/layout/AppLayout';
import DownloadPage from './pages/DownloadPage';
import QueuePage from './pages/QueuePage';
import PlaylistPage from './pages/PlaylistPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import SetupPage from './components/setup/SetupPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import DesktopMacIcon from '@mui/icons-material/DesktopMac';

function QueueListener() {
  useQueue();
  return null;
}

/** Shown when the user opens the app in a regular browser instead of the Tauri window */
function BrowserModeBanner() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 3,
        background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
        color: '#F4F4F5',
        textAlign: 'center',
        p: 4,
      }}
    >
      <Box
        sx={{
          width: 72, height: 72, borderRadius: 3,
          background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1,
        }}
      >
        <DesktopMacIcon sx={{ fontSize: 38, color: '#fff' }} />
      </Box>
      <Box>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          YT Downloader
        </Typography>
        <Typography variant="h6" fontWeight={500} color="rgba(255,255,255,0.6)" gutterBottom>
          This is a desktop application
        </Typography>
        <Typography variant="body1" color="rgba(255,255,255,0.45)" sx={{ maxWidth: 420, mx: 'auto' }}>
          Please open the <strong style={{ color: '#60A5FA' }}>YT Downloader desktop app</strong> instead of this browser tab.
          The app requires the Tauri runtime to communicate with yt-dlp.
        </Typography>
      </Box>
      <Button
        variant="outlined"
        sx={{ color: '#60A5FA', borderColor: 'rgba(96,165,250,0.4)', mt: 1 }}
        onClick={() => window.location.reload()}
      >
        Refresh Page
      </Button>
    </Box>
  );
}

function AppContent() {
  const themeMode = useSettingsStore((s) => s.settings.theme);
  const [setupDone, setSetupDone] = useState(false);

  // Resolve 'system' preference
  const [systemDark, setSystemDark] = React.useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemDark);

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDark]);

  const theme = useMemo(() =>
    createTheme({
      palette: {
        mode: isDark ? 'dark' : 'light',
        primary: {
          main: '#ff4d4d', // sketch accent
        },
        background: {
          default: 'transparent',
          paper: 'transparent',
        },
        text: isDark
          ? { primary: '#fdfbf7', secondary: 'rgba(253, 251, 247, 0.7)' }
          : { primary: '#2d2d2d', secondary: 'rgba(45, 45, 45, 0.7)' },
      },
      typography: {
        fontFamily: '"Patrick Hand", "Comic Sans MS", cursive, sans-serif',
        h1: { fontFamily: '"Kalam", cursive', fontWeight: 700 },
        h2: { fontFamily: '"Kalam", cursive', fontWeight: 700 },
        h3: { fontFamily: '"Kalam", cursive', fontWeight: 700 },
        h4: { fontFamily: '"Kalam", cursive', fontWeight: 700 },
        h5: { fontFamily: '"Kalam", cursive', fontWeight: 700 },
        h6: { fontFamily: '"Kalam", cursive', fontWeight: 700 },
        button: { fontFamily: '"Kalam", cursive', fontWeight: 700, textTransform: 'none', fontSize: '1.1rem' },
      },
      shape: { borderRadius: 0 },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              boxShadow: 'none',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            },
          },
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              fontFamily: '"Patrick Hand", cursive',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
              border: '1.5px solid rgba(253,251,247,0.8)',
              boxShadow: '2px 2px 0 0 rgba(45,45,45,0.85)',
            },
          },
        },
      },
    }),
    [isDark]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Non-Tauri browser fallback */}
      {!IS_TAURI ? (
        <BrowserModeBanner />
      ) : !setupDone ? (
        /* First-run setup wizard: download yt-dlp if missing */
        <SetupPage onComplete={() => setSetupDone(true)} />
      ) : (
        /* Main app */
        <>
          <QueueListener />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<DownloadPage />} />
                <Route path="queue" element={<QueuePage />} />
                <Route path="playlist" element={<PlaylistPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: isDark ? '#1c1917' : '#fdfbf7',
                color: isDark ? '#fdfbf7' : '#2d2d2d',
                border: '2px solid',
                borderColor: isDark ? 'rgba(253,251,247,0.7)' : 'rgba(45,45,45,0.7)',
                borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                boxShadow: '3px 3px 0 0 rgba(45,45,45,0.6)',
                fontFamily: '"Patrick Hand", cursive',
                fontSize: '1rem',
                fontWeight: 600,
              },
              success: {
                iconTheme: { primary: '#10B981', secondary: isDark ? '#1c1917' : '#fdfbf7' },
              },
              error: {
                iconTheme: { primary: '#EF4444', secondary: isDark ? '#1c1917' : '#fdfbf7' },
              },
            }}
          />
        </>
      )}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
