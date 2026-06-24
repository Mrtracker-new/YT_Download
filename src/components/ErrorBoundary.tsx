import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Production-quality error boundary that catches any render error in the tree
 * and shows a friendly recovery UI instead of a blank screen.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production you'd send this to a crash reporter (Sentry, etc.)
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 2,
            p: 4,
            textAlign: 'center',
            fontFamily: '"Patrick Hand", cursive',
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 56, color: '#ff4d4d', mb: 1 }} />
          <Typography variant="h4" sx={{ fontFamily: '"Kalam", cursive', color: '#ff4d4d' }}>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480, fontFamily: 'inherit' }}>
            The app crashed unexpectedly. This is usually caused by a temporary glitch.
          </Typography>
          {/* Show error details when running locally (dev mode) */}
          {(window?.location?.hostname === 'localhost' || window?.location?.protocol === 'tauri:') && this.state.error && (
            <Box
              component="pre"
              sx={{
                mt: 1,
                p: 2,
                bgcolor: 'rgba(255,77,77,0.08)',
                border: '1px dashed rgba(255,77,77,0.4)',
                borderRadius: '8px',
                fontSize: '0.7rem',
                textAlign: 'left',
                overflowX: 'auto',
                maxWidth: '100%',
                color: '#ff4d4d',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </Box>
          )}
          <Button
            onClick={this.handleReset}
            sx={{
              mt: 2,
              fontFamily: '"Kalam", cursive',
              fontWeight: 700,
              fontSize: '1.1rem',
              px: 4,
              py: 1.25,
              border: '2px solid #ff4d4d',
              borderRadius: '15px 225px 15px 255px/255px 15px 225px 15px',
              color: '#ff4d4d',
              bgcolor: 'transparent',
              boxShadow: '3px 3px 0 0 rgba(255,77,77,0.4)',
              '&:hover': {
                bgcolor: 'rgba(255,77,77,0.1)',
                transform: 'rotate(-1deg) translateY(-1px)',
              },
            }}
          >
            Reload App
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
