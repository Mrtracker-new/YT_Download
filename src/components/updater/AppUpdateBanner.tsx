import { useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { openReleasePage } from '../../services/updaterService';
import { useUpdateContext } from './UpdateContext';

const SKETCH_RADIUS = '255px 15px 225px 15px/15px 225px 15px 255px';

/**
 * Dismissable sticky banner shown at the top of the app when a newer release is
 * available. Reads update state from context — renders nothing when there's no
 * update (null-safe), so it can sit unconditionally in the layout.
 */
export function AppUpdateBanner() {
  const ctx = useUpdateContext();
  const [showNotes, setShowNotes] = useState(false);

  const appUpdate = ctx?.appUpdate;
  if (!ctx || !appUpdate || !appUpdate.available) return null;

  const sketchButton = (color: string, dashed = false) => ({
    px: 1.5,
    py: 0.5,
    cursor: 'pointer',
    fontFamily: '"Patrick Hand", cursive',
    fontWeight: 700,
    fontSize: '0.85rem',
    color,
    bgcolor: 'transparent',
    border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
    borderRadius: SKETCH_RADIUS,
    transition: 'transform 0.15s ease',
    '&:hover': { transform: 'translateY(-1px) rotate(-0.5deg)' },
    '&:active': { transform: 'translateY(1px)' },
  });

  return (
    <Box
      sx={{
        m: 1.5,
        p: 1.5,
        bgcolor: 'background.paper',
        border: '2px solid',
        borderColor: 'primary.main',
        borderLeft: '5px solid',
        borderLeftColor: 'primary.main',
        borderRadius: SKETCH_RADIUS,
        boxShadow: '3px 3px 0 0 rgba(255,77,77,0.45)',
        animation: 'updateBannerSlide 0.4s ease',
        '@keyframes updateBannerSlide': {
          from: { opacity: 0, transform: 'translateY(-12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <RocketLaunchIcon sx={{ color: 'primary.main', fontSize: 24, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontFamily: 'Kalam', fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.2 }}>
            YT Downloader v{appUpdate.latestVersion} is available!
          </Typography>
          <Typography sx={{ fontFamily: 'Patrick Hand', fontSize: '0.85rem', color: 'text.secondary' }}>
            You're on v{appUpdate.currentVersion}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {appUpdate.releaseNotes && (
            <Box
              component="button"
              onClick={() => setShowNotes((v) => !v)}
              sx={{
                ...sketchButton('inherit', true),
                display: 'flex',
                alignItems: 'center',
                gap: 0.3,
              }}
            >
              <ExpandMoreIcon
                sx={{
                  fontSize: 18,
                  transform: showNotes ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
              Release Notes
            </Box>
          )}
          <Box
            component="button"
            onClick={() => ctx.skipAppVersion(appUpdate.latestVersion ?? '')}
            sx={sketchButton('#6B7280', true)}
          >
            Skip this version
          </Box>
          <Box component="button" onClick={ctx.dismissAppUpdate} sx={sketchButton('#6B7280', true)}>
            Later
          </Box>
          <Box
            component="button"
            className="sketch-button"
            onClick={() => openReleasePage(appUpdate.releaseUrl).catch(console.error)}
            sx={{ fontSize: '0.85rem', px: 1.5, py: 0.5 }}
          >
            View Release
          </Box>
        </Box>
      </Box>

      {appUpdate.releaseNotes && (
        <Collapse in={showNotes}>
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              maxHeight: 200,
              overflow: 'auto',
              border: '1.5px dashed',
              borderColor: 'text.secondary',
              borderRadius: SKETCH_RADIUS,
              fontFamily: 'Patrick Hand',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              color: 'text.secondary',
            }}
          >
            {appUpdate.releaseNotes}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
