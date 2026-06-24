import { useEffect, useState } from 'react';
import {
  Box, Typography, LinearProgress, Stack, CircularProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  checkSetup, downloadYtdlp, downloadFfmpeg, onSetupProgress,
  type BinaryCheckResult, type SetupProgress, type UnlistenFn,
} from '../../services/tauriApi';

interface Props {
  onComplete: () => void;
}

type StepState = 'idle' | 'running' | 'done' | 'error' | 'skipped';

interface Step {
  key: 'ytdlp' | 'ffmpeg';
  label: string;
  description: string;
  required: boolean;
  state: StepState;
  progress: number;
  message: string;
  error?: string;
}

// ── Sketch Badge — replaces MUI Chip (Chip overrides borderRadius internally) ──
const SketchBadge = ({ label, color }: { label: string; color: string }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      px: 1,
      py: 0.2,
      fontSize: '0.72rem',
      fontFamily: 'Patrick Hand',
      fontWeight: 700,
      lineHeight: 1,
      color,
      bgcolor: 'transparent',
      border: `2px solid ${color}`,
      borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
      boxShadow: `1px 1px 0 0 ${color}66`,
      userSelect: 'none',
      whiteSpace: 'nowrap',
      transform: 'rotate(0.5deg)',
    }}
  >
    {label}
  </Box>
);

export default function SetupPage({ onComplete }: Props) {
  const [checking, setChecking] = useState(true);
  const [checkResult, setCheckResult] = useState<BinaryCheckResult | null>(null);
  const [steps, setSteps] = useState<Step[]>([
    {
      key: 'ytdlp',
      label: 'yt-dlp',
      description: 'The core download engine. Required for all downloads.',
      required: true,
      state: 'idle',
      progress: 0,
      message: '',
    },
    {
      key: 'ffmpeg',
      label: 'ffmpeg',
      description: 'Audio/video processing. Required for MP3 & quality merging.',
      required: false,
      state: 'idle',
      progress: 0,
      message: '',
    },
  ]);
  const [downloading, setDownloading] = useState(false);
  const [overallError, setOverallError] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    async function init() {
      unlisten = await onSetupProgress((payload: SetupProgress) => {
        setSteps((prev) =>
          prev.map((s) =>
            s.key === payload.name
              ? {
                  ...s,
                  progress: payload.progress,
                  message: payload.message,
                  state:
                    payload.status === 'complete'
                      ? 'done'
                      : payload.status === 'error'
                      ? 'error'
                      : 'running',
                }
              : s
          )
        );
      });

      try {
        const result = await checkSetup();
        setCheckResult(result);
        setSteps((prev) =>
          prev.map((s) => ({
            ...s,
            state:
              (s.key === 'ytdlp' && result.ytdlpFound) ||
              (s.key === 'ffmpeg' && result.ffmpegFound)
                ? 'done'
                : 'idle',
            message:
              (s.key === 'ytdlp' && result.ytdlpFound) ||
              (s.key === 'ffmpeg' && result.ffmpegFound)
                ? 'Already installed'
                : '',
          }))
        );
        if (result.ytdlpFound) {
          onComplete();
          return;
        }
      } catch (e) {
        setOverallError(`Failed to check binaries: ${e}`);
      } finally {
        setChecking(false);
      }
    }

    init().catch(console.error);
    return () => { if (unlisten) unlisten(); };
  }, [onComplete]);

  const updateStep = (key: string, partial: Partial<Step>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...partial } : s)));

  const runSetup = async (skipFfmpeg = false) => {
    setDownloading(true);
    setOverallError(null);

    const ytdlpStep = steps.find((s) => s.key === 'ytdlp');
    const ffmpegStep = steps.find((s) => s.key === 'ffmpeg');

    if (ytdlpStep && ytdlpStep.state !== 'done') {
      updateStep('ytdlp', { state: 'running', message: 'Starting...' });
      try {
        await downloadYtdlp();
        updateStep('ytdlp', { state: 'done', progress: 100, message: 'Installed!' });
      } catch (e) {
        const msg = String(e);
        updateStep('ytdlp', { state: 'error', error: msg, message: 'Failed' });
        setOverallError(`yt-dlp download failed: ${msg}`);
        setDownloading(false);
        return;
      }
    }

    if (!skipFfmpeg && ffmpegStep && ffmpegStep.state !== 'done') {
      updateStep('ffmpeg', { state: 'running', message: 'Starting...' });
      try {
        await downloadFfmpeg();
        updateStep('ffmpeg', { state: 'done', progress: 100, message: 'Installed!' });
      } catch (e) {
        const msg = String(e);
        updateStep('ffmpeg', { state: 'error', error: msg, message: 'Failed (optional)' });
      }
    } else if (skipFfmpeg) {
      updateStep('ffmpeg', { state: 'skipped', message: 'Skipped' });
    }

    setDownloading(false);
    onComplete();
  };

  // ── Loading splash ──────────────────────────────────────────────────────────
  if (checking) {
    return (
      <Box
        sx={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: 3,
        }}
      >
        <Box
          sx={{
            width: 56, height: 56,
            bgcolor: 'primary.main',
            border: '2px solid',
            borderColor: 'text.primary',
            borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
            boxShadow: '4px 4px 0 0 rgba(45,45,45,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'rotate(-3deg)',
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { transform: 'rotate(-3deg) scale(1)' },
              '50%': { transform: 'rotate(-3deg) scale(1.06)' },
            },
          }}
        >
          <DownloadIcon sx={{ color: '#fff', fontSize: 26 }} />
        </Box>
        <Typography
          sx={{ fontFamily: 'Kalam', fontSize: '1.3rem', color: 'text.secondary' }}
        >
          Checking tools…
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', p: 4,
        // Subtle lined-paper texture vibe
        backgroundImage: `repeating-linear-gradient(
          transparent,
          transparent 27px,
          rgba(128,128,128,0.07) 27px,
          rgba(128,128,128,0.07) 28px
        )`,
      }}
    >
      {/* ── Main card ── */}
      <Box
        className="tape-decoration relative"
        sx={{
          p: 4,
          maxWidth: 520,
          width: '100%',
          bgcolor: 'background.paper',
          border: '2px solid',
          borderColor: 'text.primary',
          borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
          boxShadow: '6px 6px 0 0 rgba(45,45,45,0.85)',
          '.dark-mode &': { boxShadow: '6px 6px 0 0 rgba(0,0,0,0.85)' },
          transform: 'rotate(-1deg)',
        }}
      >
        {/* ── Header ── */}
        <Stack spacing={1} mb={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              className="wobbly-card"
              sx={{
                width: 52, height: 52,
                bgcolor: 'primary.main',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: 'rotate(-4deg)',
                flexShrink: 0,
              }}
            >
              <DownloadIcon sx={{ color: '#fff', fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700} sx={{ fontFamily: 'Kalam', lineHeight: 1.1 }}>
                First-Time Setup
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '1rem', mt: 0.25 }}>
                We need to grab two small tools before you start downloading.
              </Typography>
            </Box>
          </Box>
        </Stack>

        {/* ── Dashed divider — hand-drawn rule ── */}
        <Box sx={{ borderBottom: '2px dashed', borderBottomColor: 'text.primary', opacity: 0.35, mb: 3 }} />

        {/* ── Step cards ── */}
        <Stack spacing={2} mb={3}>
          {steps.map((step, i) => {
            const cardRotation = i % 2 === 0 ? '0.6deg' : '-0.4deg';
            const stateIcon =
              step.state === 'done'    ? <CheckCircleIcon sx={{ color: '#10B981', fontSize: 20 }} /> :
              step.state === 'error'   ? <ErrorIcon sx={{ color: '#EF4444', fontSize: 20 }} /> :
              step.state === 'skipped' ? <WarningAmberIcon sx={{ color: '#F59E0B', fontSize: 20 }} /> :
              step.state === 'running' ? <CircularProgress size={16} sx={{ color: 'primary.main' }} /> :
              null;

            const cardBorderColor =
              step.state === 'done'    ? '#10B981' :
              step.state === 'error'   ? '#EF4444' :
              step.state === 'running' ? 'primary.main' :
              'text.primary';

            const cardShadowColor =
              step.state === 'done'    ? 'rgba(16,185,129,0.5)' :
              step.state === 'error'   ? 'rgba(239,68,68,0.5)' :
              step.state === 'running' ? 'rgba(59,130,246,0.5)' :
              'rgba(45,45,45,0.6)';

            return (
              <Box
                key={step.key}
                sx={{
                  p: 2,
                  bgcolor: 'background.paper',
                  border: '2px solid',
                  borderColor: cardBorderColor,
                  borderLeft: `5px solid`,
                  borderLeftColor: cardBorderColor,
                  borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                  boxShadow: `3px 3px 0 0 ${cardShadowColor}`,
                  '.dark-mode &': { boxShadow: `3px 3px 0 0 ${cardShadowColor}` },
                  transform: `rotate(${cardRotation})`,
                  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                }}
              >
                {/* Title row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography
                        fontWeight={700}
                        sx={{ fontFamily: 'Kalam', fontSize: '1.25rem', lineHeight: 1 }}
                      >
                        {step.label}
                      </Typography>
                      {/* Custom Box badge — MUI Chip overrides borderRadius */}
                      <SketchBadge
                        label={step.required ? 'Required' : 'Optional'}
                        color={step.required ? '#EF4444' : '#6B7280'}
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontFamily: 'Patrick Hand', fontSize: '0.9rem', display: 'block' }}
                    >
                      {step.description}
                    </Typography>
                  </Box>

                  {/* State icon */}
                  <Box sx={{ flexShrink: 0, ml: 1.5, mt: 0.25 }}>
                    {stateIcon}
                  </Box>
                </Box>

                {/* Progress bar */}
                {(step.state === 'running' || step.state === 'done') && step.progress > 0 && (
                  <Box mt={1.5}>
                    <LinearProgress
                      variant="determinate"
                      value={step.progress}
                      sx={{
                        height: 8,
                        borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                        border: '1.5px solid',
                        borderColor: 'text.primary',
                        bgcolor: 'rgba(0,0,0,0.06)',
                        '.dark-mode &': { bgcolor: 'rgba(255,255,255,0.06)' },
                        '& .MuiLinearProgress-bar': {
                          bgcolor: step.state === 'done' ? '#10B981' : 'primary.main',
                          borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ mt: 0.5, display: 'block', fontFamily: 'Patrick Hand', color: 'text.secondary' }}
                    >
                      {step.message}
                    </Typography>
                  </Box>
                )}

                {/* Done message */}
                {step.state === 'done' && step.progress === 0 && (
                  <Typography
                    variant="caption"
                    sx={{ color: '#10B981', display: 'block', mt: 0.5, fontFamily: 'Patrick Hand', fontSize: '0.9rem' }}
                  >
                    ✓ {step.message || 'Ready to go!'}
                  </Typography>
                )}

                {/* Error message */}
                {step.state === 'error' && step.error && (
                  <Typography
                    variant="caption"
                    sx={{ color: '#EF4444', display: 'block', mt: 0.5, fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}
                  >
                    ⚠️ {step.error}
                  </Typography>
                )}

                {/* Skipped */}
                {step.state === 'skipped' && (
                  <Typography
                    variant="caption"
                    sx={{ color: '#F59E0B', display: 'block', mt: 0.5, fontFamily: 'Patrick Hand', fontSize: '0.9rem' }}
                  >
                    ↷ Skipped — MP3 conversion will be unavailable
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>

        {/* ── Error banner ── */}
        {overallError && (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              border: '2px solid #EF4444',
              borderLeft: '5px solid #EF4444',
              borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
              bgcolor: 'rgba(239,68,68,0.08)',
              boxShadow: '3px 3px 0 0 rgba(239,68,68,0.4)',
              display: 'flex', alignItems: 'flex-start', gap: 1,
            }}
          >
            <Typography sx={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>⚠️</Typography>
            <Typography
              variant="caption"
              sx={{ color: '#EF4444', fontFamily: 'Patrick Hand', fontSize: '0.9rem', lineHeight: 1.4 }}
            >
              {overallError}
            </Typography>
          </Box>
        )}

        {/* ── Action buttons ── */}
        <Stack spacing={1.5}>
          {/* Primary: Download All */}
          <Box
            component="button"
            className="sketch-button"
            disabled={downloading || steps.every((s) => s.state === 'done')}
            onClick={() => runSetup(false)}
            sx={{
              width: '100%', py: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
              fontSize: '1.1rem',
            }}
          >
            {downloading
              ? <><CircularProgress size={16} sx={{ color: 'inherit' }} />&nbsp;Downloading…</>
              : <><DownloadIcon sx={{ fontSize: 18 }} /> Download All Tools</>
            }
          </Box>

          {/* Secondary: Skip ffmpeg — dashed sketch button */}
          <Box
            component="button"
            disabled={downloading}
            onClick={() => runSetup(true)}
            sx={{
              width: '100%', py: 1.25,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: downloading ? 'not-allowed' : 'pointer',
              opacity: downloading ? 0.5 : 1,
              bgcolor: 'transparent',
              color: 'text.primary',
              border: '2px dashed',
              borderColor: 'text.secondary',
              borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
              fontFamily: 'Patrick Hand',
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'none',
              transition: 'all 0.15s ease',
              '&:hover:not(:disabled)': {
                borderColor: 'primary.main',
                color: 'primary.main',
                transform: 'rotate(0.5deg) translateY(-1px)',
              },
              '&:active:not(:disabled)': {
                transform: 'translateY(1px)',
              },
            }}
          >
            Download yt-dlp Only (Skip ffmpeg)
          </Box>

          {/* Tertiary: Already have it — skip */}
          {checkResult?.ytdlpFound && (
            <Box
              component="button"
              onClick={onComplete}
              sx={{
                width: '100%', py: 0.75,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                bgcolor: 'transparent',
                color: 'text.secondary',
                border: '2px solid transparent',
                borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                fontFamily: 'Patrick Hand',
                fontSize: '0.95rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
                '&:hover': {
                  color: 'text.primary',
                  borderColor: 'text.secondary',
                  transform: 'rotate(-0.5deg)',
                },
              }}
            >
              yt-dlp already found — Continue →
            </Box>
          )}
        </Stack>

        {/* ── Footer note ── */}
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{
            display: 'block', textAlign: 'center', mt: 2.5,
            fontFamily: 'Patrick Hand', fontSize: '0.85rem', lineHeight: 1.5,
          }}
        >
          📁 Tools are saved to your local app data folder.<br />
          No internet required after setup.
        </Typography>
      </Box>
    </Box>
  );
}
