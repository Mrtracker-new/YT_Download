import React from 'react';
import { Box, Typography } from '@mui/material';
import { AccessTime, Person } from '@mui/icons-material';
import type { VideoInfo } from '../../types/video';
import { formatDuration } from '../../utils/formatters';

interface VideoPreviewProps {
  videoInfo: VideoInfo;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ videoInfo }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2.5,
        p: 2.5,
        // ── Proper sketch card — no tape-decoration (causes floating gray box) ──
        border: '2px solid',
        borderColor: 'text.primary',
        borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
        // Explicit bg so it never goes transparent in dark mode
        bgcolor: '#2e2e38',
        '.light-mode &, body:not(.dark-mode) &': { bgcolor: '#ffffff' },
        boxShadow: '4px 4px 0 0 rgba(0,0,0,0.85)',
        transform: 'rotate(1.5deg)',
        animation: 'fadeSlideIn 0.35s ease-out',
        '@keyframes fadeSlideIn': {
          from: { opacity: 0, transform: 'translateY(10px) rotate(0deg)' },
          to: { opacity: 1, transform: 'translateY(0) rotate(1.5deg)' },
        },
      }}
    >
      {/* Thumbnail — Polaroid style */}
      <Box
        sx={{
          position: 'relative',
          flexShrink: 0,
          width: 160,
          // White Polaroid frame
          bgcolor: '#fff',
          p: '5px',
          pb: '20px',
          border: '1px solid rgba(0,0,0,0.12)',
          boxShadow: '2px 3px 6px rgba(0,0,0,0.25)',
          transform: 'rotate(-2deg)',
          borderRadius: '2px',
        }}
      >
        {videoInfo.thumbnail ? (
          <Box
            component="img"
            src={videoInfo.thumbnail}
            alt={videoInfo.title}
            sx={{
              width: '100%',
              height: 90,
              objectFit: 'cover',
              display: 'block',
              filter: 'sepia(0.15) contrast(1.05)',
            }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: 90,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.disabled',
              fontSize: '0.75rem',
              fontFamily: 'Patrick Hand',
            }}
          >
            No thumbnail
          </Box>
        )}

        {/* Duration badge — bottom of Polaroid frame */}
        {videoInfo.duration > 0 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 3,
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#444',
              fontSize: '0.65rem',
              fontFamily: 'Patrick Hand',
              fontWeight: 700,
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
            }}
          >
            {formatDuration(videoInfo.duration)}
          </Box>
        )}
      </Box>

      {/* Info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="h6"
          color="text.primary"
          sx={{
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.25,
            mb: 1,
            fontFamily: 'Kalam',
            fontWeight: 700,
          }}
        >
          {videoInfo.title}
        </Typography>

        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={1.5}>
          {videoInfo.uploader && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <Person sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.82rem' }}>
                {videoInfo.uploader}
              </Typography>
            </Box>
          )}

          {videoInfo.duration > 0 && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <AccessTime sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.82rem' }}>
                {formatDuration(videoInfo.duration)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Quality badges — Box instead of Chip so wobbly borderRadius applies */}
        {videoInfo.availableQualities.length > 0 && (
          <Box display="flex" gap={0.5} flexWrap="wrap">
            {videoInfo.availableQualities.slice(0, 6).map((q) => (
              <Box
                key={q}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: 0.75,
                  py: 0.15,
                  fontSize: '0.78rem',
                  fontFamily: 'Patrick Hand',
                  fontWeight: 600,
                  lineHeight: 1.5,
                  bgcolor: 'transparent',
                  color: 'text.secondary',
                  border: '1.5px solid',
                  borderColor: 'text.secondary',
                  borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                  userSelect: 'none',
                }}
              >
                {q}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default VideoPreview;
