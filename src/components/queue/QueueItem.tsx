import React, { useState, useCallback } from 'react';
import { Box, Typography, LinearProgress, Tooltip, CircularProgress } from '@mui/material';
import {
  FolderOpen,
  Cancel as CancelIcon,
  Replay as RetryIcon,
  PlayArrow as ResumeIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import type { DownloadJob } from '../../types/download';
import { formatSpeed, formatDuration, truncate } from '../../utils/formatters';
import { cancelDownload, pauseDownload, resumeDownload, retryDownload, openFolder } from '../../services/tauriApi';
import { useQueueStore } from '../../store/queueStore';
import toast from 'react-hot-toast';

interface QueueItemProps {
  job: DownloadJob;
}

const STATUS_COLORS: Record<string, string> = {
  queued:     '#64748B',
  downloading:'#3B82F6',
  merging:    '#8B5CF6',
  converting: '#8B5CF6',
  finalizing: '#8B5CF6',
  completed:  '#10B981',
  failed:     '#EF4444',
  cancelled:  '#6B7280',
  paused:     '#F59E0B',
};

const STATUS_LABELS: Record<string, string> = {
  queued:     '✏️ Queued',
  downloading:'⬇️ Downloading',
  merging:    '🎞️ Merging',
  converting: '🎞️ Converting',
  finalizing: '🎞️ Finalizing',
  completed:  '✅ Done',
  failed:     '❌ Failed',
  cancelled:  '🚫 Cancelled',
  paused:     '⏸️ Paused',
};

// Stable rotation derived from jobId chars — no random() in render
const getRotation = (jobId: string) => {
  const a = jobId.charCodeAt(0) % 2 === 0 ? -1 : 1;
  const b = (jobId.charCodeAt(1) ?? 48) % 3;
  return a * b * 0.6;
};

const QueueItem: React.FC<QueueItemProps> = ({ job }) => {
  const removeJob = useQueueStore((s) => s.removeJob);
  const [isPending, setIsPending] = useState(false);

  const isActive     = job.status === 'downloading' || job.status === 'merging' || job.status === 'converting' || job.status === 'finalizing';
  const isMerging    = job.status === 'merging' || job.status === 'converting' || job.status === 'finalizing';
  const isDownloading= job.status === 'downloading';
  const isQueued     = job.status === 'queued';
  const isDone       = job.status === 'completed';
  const isFailed     = job.status === 'failed';
  const isCancelled  = job.status === 'cancelled';
  const isPaused     = job.status === 'paused';

  const statusColor = STATUS_COLORS[job.status] ?? '#64748B';
  const rotation    = getRotation(job.jobId);

  const withPending = useCallback(
    (action: () => Promise<void>, errorMsg: string) => async () => {
      if (isPending) return;
      setIsPending(true);
      try {
        await action();
      } catch {
        toast.error(errorMsg);
      } finally {
        setIsPending(false);
      }
    },
    [isPending]
  );

  const handleCancel      = withPending(() => cancelDownload(job.jobId), 'Failed to cancel download');
  const handlePause       = withPending(() => pauseDownload(job.jobId), 'Failed to pause download');
  const handleResume      = withPending(() => resumeDownload(job.jobId), 'Failed to resume download');
  const handleRetry       = withPending(() => retryDownload(job.jobId), 'Failed to retry download');

  const handleOpenFolder  = async () => {
    if (job.filePath) {
      const dir = job.filePath.replace(/[\\/][^\\/]*$/, '');
      await openFolder(dir);
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        // ── Sketch card shell ──────────────────────────────────────────────
        bgcolor: 'background.paper',
        // Wobbly hand-drawn border shape
        borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
        border: '2px solid',
        borderColor: 'text.primary',
        // Status accent: a coloured left-edge marker (like a highlighter streak)
        borderLeft: `5px solid ${statusColor}`,
        // Hard paper shadow
        boxShadow: `4px 4px 0 0 rgba(45,45,45,0.85)`,
        '.dark-mode &': {
          boxShadow: `4px 4px 0 0 rgba(0,0,0,0.85)`,
        },
        // Slight tilt — like it was pinned to a board
        transform: `rotate(${rotation}deg)`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'rotate(0deg) translateY(-2px)',
          boxShadow: `6px 6px 0 0 rgba(45,45,45,0.85)`,
          '.dark-mode &': {
            boxShadow: `6px 6px 0 0 rgba(0,0,0,0.85)`,
          },
        },
        opacity: isPending ? 0.8 : 1,
        fontFamily: 'Patrick Hand',
        p: 2,
        // Thumbtack pin for active/queued items
        ...(isActive || isQueued ? {
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 8,
            right: 14,
            width: 10,
            height: 10,
            background: 'radial-gradient(circle at 30% 30%, #ff4d4d, #b30000)',
            borderRadius: '50%',
            boxShadow: '1px 2px 3px rgba(0,0,0,0.4)',
            zIndex: 10,
            pointerEvents: 'none',
          },
        } : {}),
      }}
    >
      <Box display="flex" gap={2} alignItems="flex-start">
        {/* Thumbnail — Polaroid style */}
        {job.thumbnail && (
          <Box
            sx={{
              flexShrink: 0,
              bgcolor: '#fff',
              p: '4px',
              pb: '12px',
              border: '1px solid rgba(0,0,0,0.15)',
              boxShadow: '1px 2px 4px rgba(0,0,0,0.15)',
              transform: `rotate(${-rotation * 1.5}deg)`,
              borderRadius: '2px',
            }}
          >
            <Box
              component="img"
              src={job.thumbnail}
              alt={job.title}
              sx={{
                width: 64,
                height: 36,
                display: 'block',
                objectFit: 'cover',
                filter: isDone ? 'none' : isCancelled || isFailed ? 'grayscale(80%)' : 'sepia(0.15)',
              }}
            />
          </Box>
        )}

        {/* Content */}
        <Box flex={1} minWidth={0} pt={0.25}>
          {/* Title row */}
          <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1} mb={0.75}>
            <Typography
              variant="h6"
              sx={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                flex: 1,
                fontFamily: 'Kalam',
                fontWeight: 700,
                fontSize: '1.1rem',
                lineHeight: 1.25,
                color: isFailed || isCancelled ? 'text.disabled' : 'text.primary',
              }}
            >
              {truncate(job.title, 55)}
            </Typography>

            {/* Status badge — custom Box so borderRadius isn't overridden by MUI Chip internals */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                px: 1.25,
                py: 0.3,
                fontSize: '0.72rem',
                fontFamily: 'Patrick Hand',
                fontWeight: 700,
                lineHeight: 1,
                color: statusColor,
                bgcolor: 'transparent',
                border: `2px solid ${statusColor}`,
                // Wobbly sketch border — works because it's a plain Box, not Chip
                borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                boxShadow: `2px 2px 0 0 ${statusColor}55`,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                userSelect: 'none',
                transform: 'rotate(0.5deg)',
              }}
            >
              {STATUS_LABELS[job.status] ?? job.status}
            </Box>
          </Box>

          {/* Meta — written like pencil annotations */}
          <Box display="flex" gap={1.5} mb={1} flexWrap="wrap">
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}>
              {job.audioOnly ? '🎵 MP3' : `📹 ${job.quality} MP4`}
            </Typography>
            {job.uploader && (
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}>
                · {job.uploader}
              </Typography>
            )}
            {job.duration && (
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}>
                · {formatDuration(job.duration)}
              </Typography>
            )}
          </Box>

          {/* Progress bar — marker-streak style */}
          {(isActive || isQueued || isPaused) && (
            <Box>
              <LinearProgress
                variant={isQueued || isMerging ? 'indeterminate' : 'determinate'}
                value={isQueued || isMerging ? undefined : job.progress}
                sx={{
                  height: 8,
                  borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                  bgcolor: 'rgba(0,0,0,0.08)',
                  '.dark-mode &': { bgcolor: 'rgba(255,255,255,0.08)' },
                  border: '1.5px solid',
                  borderColor: 'text.primary',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: isPaused ? '#F59E0B' : isMerging ? '#8B5CF6' : 'primary.main',
                    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                  },
                }}
              />
              {(isActive || isPaused) && (
                <Box display="flex" justifyContent="space-between" mt={0.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.8rem' }}>
                    {isMerging
                      ? '⚙️ Merging with ffmpeg…'
                      : isPaused
                      ? `⏸️ Paused at ${Math.round(job.progress)}%`
                      : `${Math.round(job.progress)}%${job.speed ? ` · ${formatSpeed(job.speed)}` : ''}`}
                  </Typography>
                  {!isMerging && !isPaused && job.eta && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.8rem' }}>
                      ETA {job.eta}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Error message */}
          {isFailed && job.error && (
            <Typography
              variant="caption"
              sx={{ color: '#EF4444', display: 'block', fontFamily: 'Patrick Hand', fontSize: '0.82rem', mt: 0.5 }}
            >
              ⚠️ {truncate(job.error, 80)}
            </Typography>
          )}
        </Box>

        {/* Action buttons — sketch mini-button style */}
        <Box display="flex" flexDirection="column" gap={0.75} alignItems="center" flexShrink={0} pt={0.5}>
          {isPending && (
            <CircularProgress size={18} thickness={4} sx={{ color: 'text.secondary', my: 0.25 }} />
          )}

          {/* Open folder — sketch stamp button */}
          {isDone && job.filePath && !isPending && (
            <Tooltip title="Open folder">
              <Box
                component="button"
                onClick={handleOpenFolder}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.4,
                  cursor: 'pointer',
                  bgcolor: 'transparent',
                  color: '#10B981',
                  border: '2px solid #10B981',
                  borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                  boxShadow: '2px 2px 0 0 #10B981',
                  fontFamily: 'Patrick Hand',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    transform: 'translate(-1px, -1px)',
                    boxShadow: '3px 3px 0 0 #10B981',
                  },
                  '&:active': { transform: 'translate(1px, 1px)', boxShadow: 'none' },
                }}
              >
                <FolderOpen sx={{ fontSize: 14 }} />
                Open
              </Box>
            </Tooltip>
          )}

          {/* Pause / Cancel — active downloads */}
          {(isActive || isQueued) && !isPending && (
            <Box display="flex" flexDirection="column" gap={0.5} alignItems="center">
              {isDownloading && (
                <Tooltip title="Pause">
                  <Box
                    component="button"
                    onClick={handlePause}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                      p: 0.5, bgcolor: 'transparent', color: '#F59E0B',
                      border: '2px solid #F59E0B',
                      borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                      boxShadow: '2px 2px 0 0 #F59E0B',
                      transition: 'all 0.15s ease',
                      '&:hover': { transform: 'rotate(5deg) translate(-1px,-1px)', boxShadow: '3px 3px 0 0 #F59E0B' },
                      '&:active': { transform: 'translate(1px,1px)', boxShadow: 'none' },
                    }}
                  >
                    <PauseIcon sx={{ fontSize: 14 }} />
                  </Box>
                </Tooltip>
              )}
              {isMerging && (
                <Tooltip title="Merging — cannot pause">
                  <Box
                    sx={{
                      display: 'inline-flex', alignItems: 'center',
                      p: 0.5, color: 'rgba(139,92,246,0.4)',
                      border: '2px solid rgba(139,92,246,0.3)',
                      borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                      cursor: 'not-allowed',
                    }}
                  >
                    <PauseIcon sx={{ fontSize: 14 }} />
                  </Box>
                </Tooltip>
              )}
              <Tooltip title="Cancel">
                <Box
                  component="button"
                  onClick={handleCancel}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                    p: 0.5, bgcolor: 'transparent', color: '#EF4444',
                    border: '2px solid #EF4444',
                    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                    boxShadow: '2px 2px 0 0 #EF4444',
                    transition: 'all 0.15s ease',
                    '&:hover': { transform: 'rotate(-5deg) translate(-1px,-1px)', boxShadow: '3px 3px 0 0 #EF4444' },
                    '&:active': { transform: 'translate(1px,1px)', boxShadow: 'none' },
                  }}
                >
                  <CancelIcon sx={{ fontSize: 14 }} />
                </Box>
              </Tooltip>
            </Box>
          )}

          {/* Resume / Cancel — paused */}
          {isPaused && !isPending && (
            <Box display="flex" flexDirection="column" gap={0.5} alignItems="center">
              <Tooltip title="Resume">
                <Box
                  component="button"
                  onClick={handleResume}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                    p: 0.5, bgcolor: 'transparent', color: '#3B82F6',
                    border: '2px solid #3B82F6',
                    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                    boxShadow: '2px 2px 0 0 #3B82F6',
                    transition: 'all 0.15s ease',
                    '&:hover': { transform: 'rotate(5deg) translate(-1px,-1px)', boxShadow: '3px 3px 0 0 #3B82F6' },
                    '&:active': { transform: 'translate(1px,1px)', boxShadow: 'none' },
                  }}
                >
                  <ResumeIcon sx={{ fontSize: 14 }} />
                </Box>
              </Tooltip>
              <Tooltip title="Cancel">
                <Box
                  component="button"
                  onClick={handleCancel}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                    p: 0.5, bgcolor: 'transparent', color: '#EF4444',
                    border: '2px solid #EF4444',
                    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                    boxShadow: '2px 2px 0 0 #EF4444',
                    transition: 'all 0.15s ease',
                    '&:hover': { transform: 'rotate(-5deg) translate(-1px,-1px)', boxShadow: '3px 3px 0 0 #EF4444' },
                    '&:active': { transform: 'translate(1px,1px)', boxShadow: 'none' },
                  }}
                >
                  <CancelIcon sx={{ fontSize: 14 }} />
                </Box>
              </Tooltip>
            </Box>
          )}

          {/* Retry — failed or cancelled */}
          {(isFailed || isCancelled) && !isPending && (
            <Tooltip title="Retry download">
              <Box
                component="button"
                onClick={handleRetry}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.4, cursor: 'pointer',
                  bgcolor: 'transparent', color: '#3B82F6',
                  border: '2px solid #3B82F6',
                  borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                  boxShadow: '2px 2px 0 0 #3B82F6',
                  fontFamily: 'Patrick Hand', fontSize: '0.75rem', fontWeight: 700,
                  transition: 'all 0.15s ease',
                  '&:hover': { transform: 'rotate(-10deg) translate(-1px,-1px)', boxShadow: '3px 3px 0 0 #3B82F6' },
                  '&:active': { transform: 'translate(1px,1px)', boxShadow: 'none' },
                }}
              >
                <RetryIcon sx={{ fontSize: 14 }} />
                Retry
              </Box>
            </Tooltip>
          )}

          {/* Remove from list — done/failed/cancelled */}
          {(isCancelled || isFailed || isDone) && !isPending && (
            <Tooltip title="Remove from list">
              <Box
                component="button"
                onClick={() => removeJob(job.jobId)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                  p: 0.5, bgcolor: 'transparent', color: 'text.disabled',
                  border: '2px solid',
                  borderColor: 'divider',
                  borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: '#EF4444',
                    borderColor: '#EF4444',
                    boxShadow: '2px 2px 0 0 #EF4444',
                    transform: 'rotate(90deg)',
                  },
                  '&:active': { transform: 'rotate(90deg) translate(1px,1px)', boxShadow: 'none' },
                }}
              >
                <CancelIcon sx={{ fontSize: 14 }} />
              </Box>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default QueueItem;
