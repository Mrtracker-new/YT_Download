import { useEffect, useRef, useState } from 'react';
import { Box, Typography, LinearProgress, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { onSetupProgress, type SetupProgress, type UnlistenFn } from '../../services/tauriApi';
import { updateYtdlp, type YtdlpUpdateInfo } from '../../services/updaterService';

const SKETCH_RADIUS = '255px 15px 225px 15px/15px 225px 15px 255px';

type Phase = 'downloading' | 'complete' | 'error';

interface Props {
  ytdlpUpdate: YtdlpUpdateInfo;
  onDone: () => void;
}

/**
 * Progress modal for the yt-dlp re-download. Listens to the existing
 * `setup://progress` stream (name = "yt-dlp"), drives a progress bar, then
 * auto-closes on success. On failure it surfaces a Retry button.
 */
export function YtdlpUpdateModal({ ytdlpUpdate, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('downloading');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Starting…');
  const [error, setError] = useState<string | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const run = async () => {
    setPhase('downloading');
    setProgress(0);
    setMessage('Starting…');
    setError(null);

    let unlisten: UnlistenFn | null = null;
    try {
      unlisten = await onSetupProgress((p: SetupProgress) => {
        if (p.name !== 'yt-dlp') return;
        setProgress(p.progress);
        setMessage(p.message);
        if (p.status === 'error') {
          setPhase('error');
          setError(p.message);
        }
      });

      await updateYtdlp();
      setPhase('complete');
      setProgress(100);
      setMessage('yt-dlp updated successfully!');
    } catch (e) {
      setPhase('error');
      setError(String(e));
    } finally {
      if (unlisten) unlisten();
    }
  };

  // Kick off the download once on mount.
  useEffect(() => {
    run();
  }, []);

  // Auto-close 2s after a successful update.
  useEffect(() => {
    if (phase !== 'complete') return;
    const timer = setTimeout(() => onDoneRef.current(), 2000);
    return () => clearTimeout(timer);
  }, [phase]);

  const sketchButton = (color: string, filled = false) => ({
    px: 2,
    py: 0.75,
    cursor: 'pointer',
    fontFamily: '"Patrick Hand", cursive',
    fontWeight: 700,
    fontSize: '0.95rem',
    color: filled ? '#fff' : color,
    bgcolor: filled ? color : 'transparent',
    border: `2px solid ${color}`,
    borderRadius: SKETCH_RADIUS,
    transition: 'transform 0.15s ease',
    '&:hover': { transform: 'translateY(-1px) rotate(-0.5deg)' },
    '&:active': { transform: 'translateY(1px)' },
  });

  const barColor = phase === 'error' ? '#EF4444' : phase === 'complete' ? '#10B981' : 'primary.main';

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.5)',
        animation: 'ytdlpModalFade 0.2s ease',
        '@keyframes ytdlpModalFade': { from: { opacity: 0 }, to: { opacity: 1 } },
      }}
    >
      <Box
        sx={{
          width: '90%',
          maxWidth: 440,
          p: 3,
          bgcolor: 'background.paper',
          border: '2px solid',
          borderColor: 'text.primary',
          borderRadius: SKETCH_RADIUS,
          boxShadow: '6px 6px 0 0 rgba(45,45,45,0.85)',
          '.dark-mode &': { boxShadow: '6px 6px 0 0 rgba(0,0,0,0.85)' },
          transform: 'rotate(-0.5deg)',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {phase === 'complete' && <CheckCircleIcon sx={{ color: '#10B981', fontSize: 24 }} />}
          {phase === 'error' && <ErrorIcon sx={{ color: '#EF4444', fontSize: 24 }} />}
          {phase === 'downloading' && <CircularProgress size={18} sx={{ color: 'primary.main' }} />}
          <Typography sx={{ fontFamily: 'Kalam', fontWeight: 700, fontSize: '1.3rem' }}>
            {phase === 'complete' ? 'yt-dlp updated' : phase === 'error' ? 'Update failed' : 'Updating yt-dlp'}
          </Typography>
        </Box>

        {/* Version transition */}
        <Typography
          sx={{ fontFamily: 'Patrick Hand', fontSize: '1.05rem', color: 'text.secondary', mb: 2 }}
        >
          {ytdlpUpdate.currentVersion} &nbsp;→&nbsp; {ytdlpUpdate.latestVersion}
        </Typography>

        {/* Progress bar (hidden once errored) */}
        {phase !== 'error' && (
          <Box sx={{ mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 10,
                borderRadius: SKETCH_RADIUS,
                border: '1.5px solid',
                borderColor: 'text.primary',
                bgcolor: 'rgba(0,0,0,0.06)',
                '.dark-mode &': { bgcolor: 'rgba(255,255,255,0.06)' },
                '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: SKETCH_RADIUS },
              }}
            />
            <Typography
              sx={{ mt: 0.75, fontFamily: 'Patrick Hand', fontSize: '0.9rem', color: 'text.secondary' }}
            >
              {Math.round(progress)}% &nbsp;·&nbsp; {message}
            </Typography>
          </Box>
        )}

        {/* Error message */}
        {phase === 'error' && error && (
          <Typography
            sx={{ fontFamily: 'Patrick Hand', fontSize: '0.9rem', color: '#EF4444', mb: 1, lineHeight: 1.4 }}
          >
            ⚠️ {error}
          </Typography>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          {phase === 'error' && (
            <>
              <Box component="button" onClick={onDone} sx={sketchButton('#6B7280')}>
                Close
              </Box>
              <Box
                component="button"
                className="sketch-button"
                onClick={run}
                sx={{ fontSize: '0.95rem', px: 2, py: 0.75 }}
              >
                Retry
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
