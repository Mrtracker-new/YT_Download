import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Button,
  FormControl,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Collapse,
  CircularProgress,
} from '@mui/material';
import { Audiotrack, Videocam, ClosedCaption as SubtitleIcon } from '@mui/icons-material';
import { getSubtitleLanguages } from '../../services/tauriApi';
import type { VideoInfo, SubtitleOptions } from '../../types/video';

interface FormatSelectorProps {
  videoInfo: VideoInfo;
  audioOnly: boolean;
  setAudioOnly: (v: boolean) => void;
  quality: string;
  setQuality: (v: string) => void;
  subtitleOptions: SubtitleOptions;
  setSubtitleOptions: (v: SubtitleOptions) => void;
  disabled: boolean;
}

type SubtitleMode = 'off' | 'embed' | 'sidecar';

const qualityLabelMap: Record<string, string> = {
  '2160p': '4K',
  '1440p': '2K',
  '1080p': '1080p',
  '720p': '720p',
  '480p': '480p',
  '360p': '360p',
  '240p': '240p',
  '144p': '144p',
};

const FormatSelector: React.FC<FormatSelectorProps> = ({
  videoInfo,
  audioOnly,
  setAudioOnly,
  quality,
  setQuality,
  subtitleOptions,
  setSubtitleOptions,
  disabled,
}) => {
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('off');
  const [subtitleLangs, setSubtitleLangs] = useState<{ code: string; name: string }[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(false);

  const qualities = videoInfo.availableQualities.map((q) => ({
    label: qualityLabelMap[q] || q,
    value: q,
  }));

  // Load subtitle languages when subtitle panel opens
  useEffect(() => {
    if (subtitleMode === 'off' || audioOnly) return;
    setLoadingLangs(true);
    const url = `https://www.youtube.com/watch?v=${videoInfo.videoId}`;
    getSubtitleLanguages(url)
      .then((data) => {
        const seen = new Set<string>();
        const merged: { code: string; name: string }[] = [];
        for (const entry of [...data.manual, ...data.auto]) {
          if (!seen.has(entry.code)) {
            seen.add(entry.code);
            merged.push(entry);
          }
        }
        setSubtitleLangs(merged.length ? merged : [{ code: 'en', name: 'English' }]);
      })
      .catch(() => setSubtitleLangs([{ code: 'en', name: 'English' }]))
      .finally(() => setLoadingLangs(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitleMode, audioOnly]);

  const handleSubtitleModeChange = (_: unknown, mode: string | null) => {
    if (!mode) return;
    const m = mode as SubtitleMode;
    setSubtitleMode(m);
    setSubtitleOptions({
      ...subtitleOptions,
      enabled: m !== 'off',
      mode: m === 'off' ? 'embed' : (m as 'embed' | 'sidecar'),
    });
  };

  const sectionLabel = (text: string, icon?: React.ReactElement) => (
    <Box display="flex" alignItems="center" gap={0.75} mb={1.5}>
      {icon && React.cloneElement(icon, { sx: { fontSize: 18, color: 'text.primary', mr: 0.5 } })}
      <Typography
        variant="h6"
        color="text.primary"
        fontWeight={700}
        sx={{ fontFamily: 'Kalam', fontSize: '1.2rem' }}
      >
        {text}
      </Typography>
    </Box>
  );

  const toggleGroupSx = {
    bgcolor: 'transparent',
    border: '2px solid',
    borderColor: 'text.primary',
    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
    p: 0.5,
    gap: 0.5,
    '& .MuiToggleButton-root': {
      border: 0,
      borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px !important',
      color: 'text.secondary',
      fontFamily: 'Patrick Hand',
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '1rem',
      py: 1,
      flex: 1,
      transition: 'all 0.15s ease',
      '&.Mui-selected': {
        bgcolor: 'primary.main',
        color: '#fff',
        boxShadow: '2px 2px 0 0 rgba(0,0,0,0.8)',
        transform: 'scale(1.02) rotate(-1deg)',
        '&:hover': { bgcolor: 'primary.main' },
      },
      '&:hover:not(.Mui-selected)': { bgcolor: 'rgba(0,0,0,0.05)', transform: 'rotate(1deg)' },
    },
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* Format */}
      <Box>
        {sectionLabel('Format')}
        <ToggleButtonGroup
          value={audioOnly ? 'audio' : 'video'}
          exclusive
          fullWidth
          disabled={disabled}
          onChange={(_, v) => { if (v) { setAudioOnly(v === 'audio'); if (v === 'audio') setSubtitleMode('off'); } }}
          sx={toggleGroupSx}
        >
          <ToggleButton value="video">
            <Videocam sx={{ mr: 0.75, fontSize: 18 }} /> Video
          </ToggleButton>
          <ToggleButton value="audio">
            <Audiotrack sx={{ mr: 0.75, fontSize: 18 }} /> Audio Only (MP3)
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Quality grid */}
      {!audioOnly && qualities.length > 0 && (
        <Box>
          {sectionLabel('Quality')}
          <Grid container spacing={1}>
            {qualities.map((q) => (
              <Grid item xs={4} sm={3} key={q.value}>
                <Button
                  fullWidth
                  size="small"
                  disabled={disabled}
                  onClick={() => setQuality(q.value)}
                  className={quality === q.value ? 'sticky-note' : undefined}
                  sx={{
                    fontFamily: 'Patrick Hand',
                    fontSize: '1rem',
                    fontWeight: 600,
                    border: '2px solid',
                    borderColor: quality === q.value ? 'primary.main' : 'text.primary',
                    bgcolor: quality === q.value ? 'primary.main' : 'transparent',
                    color: quality === q.value ? '#fff' : 'text.primary',
                    transition: 'all 0.15s ease',
                    transform: quality === q.value ? 'rotate(-2deg) scale(1.05)' : 'none',
                    boxShadow: quality === q.value ? '2px 2px 0 0 rgba(0,0,0,0.8)' : 'none',
                    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                    '&:hover': {
                      bgcolor: quality === q.value
                        ? 'primary.main'
                        : 'rgba(0,0,0,0.05)',
                      transform: quality === q.value ? 'rotate(-2deg) scale(1.05)' : 'rotate(1deg) scale(1.02)',
                    },
                  }}
                >
                  {q.label}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Subtitles */}
      {!audioOnly && (
        <Box>
          {sectionLabel('Subtitles', <SubtitleIcon />)}
          <ToggleButtonGroup
            value={subtitleMode}
            exclusive
            fullWidth
            disabled={disabled}
            onChange={handleSubtitleModeChange}
            sx={toggleGroupSx}
          >
            <ToggleButton value="off">Off</ToggleButton>
            <ToggleButton value="embed">Embed in MP4</ToggleButton>
            <ToggleButton value="sidecar">Sidecar (.srt)</ToggleButton>
          </ToggleButtonGroup>

          <Collapse in={subtitleMode !== 'off'} timeout={220}>
            <Box mt={1.5} display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 180, flex: 1 }}>
                <Select
                  value={subtitleOptions.language}
                  onChange={(e) =>
                    setSubtitleOptions({ ...subtitleOptions, language: e.target.value })
                  }
                  disabled={disabled || loadingLangs}
                  startAdornment={
                    loadingLangs
                      ? <CircularProgress size={14} sx={{ mr: 1, color: 'text.secondary' }} />
                      : null
                  }
                  sx={{
                    bgcolor: 'transparent',
                    border: '2px solid',
                    borderColor: 'text.primary',
                    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                    fontFamily: 'Patrick Hand',
                    fontSize: '1rem',
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    '& .MuiSvgIcon-root': { color: 'text.primary' },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        // Explicit hex so the popup is never transparent in dark mode
                        bgcolor: '#1e1e28',
                        border: '2px solid',
                        borderColor: 'text.primary',
                        borderRadius: '12px',
                        boxShadow: '4px 4px 0 0 rgba(0,0,0,0.8)',
                        maxHeight: 280,
                        '& .MuiMenuItem-root': {
                          fontFamily: 'Patrick Hand',
                          fontSize: '1rem',
                          color: '#fdfbf7',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                          '&.Mui-selected': { bgcolor: 'rgba(255,77,77,0.2)' },
                          '&.Mui-selected:hover': { bgcolor: 'rgba(255,77,77,0.3)' },
                        },
                        '& .MuiList-root': { py: 0.5 },
                      },
                    },
                    // Keep popup within the window
                    disablePortal: false,
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' },
                  }}
                >
                  {subtitleLangs.length === 0 && <MenuItem value="en">English (en)</MenuItem>}
                  {subtitleLangs.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.name !== lang.code ? `${lang.name} (${lang.code})` : lang.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={subtitleOptions.includeAuto}
                    onChange={(e) =>
                      setSubtitleOptions({ ...subtitleOptions, includeAuto: e.target.checked })
                    }
                    disabled={disabled}
                    size="small"
                    sx={{
                      color: 'text.secondary',
                      '&.Mui-checked': { color: 'primary.main' },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" color="text.primary" sx={{ fontFamily: 'Patrick Hand', fontSize: '1rem' }}>
                    Include auto-captions
                  </Typography>
                }
                sx={{ m: 0 }}
              />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}>
              {subtitleMode === 'embed'
                ? 'Subtitle track will be muxed into the MP4 container.'
                : 'A separate .srt file will be saved alongside the video.'}
            </Typography>
          </Collapse>
        </Box>
      )}
    </Box>
  );
};

export default FormatSelector;
