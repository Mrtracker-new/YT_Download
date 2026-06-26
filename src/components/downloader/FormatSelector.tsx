import React, { useState, useMemo } from 'react';
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
} from '@mui/material';
import {
  Audiotrack,
  Videocam,
  ClosedCaption as SubtitleIcon,
  Memory as CodecIcon,
  GraphicEq as AudioFmtIcon,
  Image as ThumbnailIcon,
  Block as SponsorIcon,
} from '@mui/icons-material';
import type { VideoInfo, SubtitleOptions, SubtitleTrack } from '../../types/video';
import type {
  AdvancedOptions,
  VideoCodec,
  AudioFormat,
  AudioBitrate,
  SponsorBlockCategory,
} from '../../types/download';

interface FormatSelectorProps {
  videoInfo: VideoInfo;
  audioOnly: boolean;
  setAudioOnly: (v: boolean) => void;
  quality: string;
  setQuality: (v: string) => void;
  subtitleOptions: SubtitleOptions;
  setSubtitleOptions: (v: SubtitleOptions) => void;
  advanced: AdvancedOptions;
  setAdvanced: (v: AdvancedOptions) => void;
  disabled: boolean;
}

type SubtitleMode = 'off' | 'embed' | 'sidecar';

const CODEC_OPTIONS: { value: VideoCodec; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'h264', label: 'H.264' },
  { value: 'vp9', label: 'VP9' },
  { value: 'av1', label: 'AV1' },
];

const AUDIO_FORMATS: { value: AudioFormat; label: string; lossless?: boolean }[] = [
  { value: 'mp3', label: 'MP3' },
  { value: 'opus', label: 'Opus' },
  { value: 'm4a', label: 'M4A (AAC)' },
  { value: 'flac', label: 'FLAC (lossless)', lossless: true },
  { value: 'wav', label: 'WAV (lossless)', lossless: true },
];

const BITRATES: AudioBitrate[] = ['128', '192', '256', '320'];

const SPONSORBLOCK_CATEGORIES: { value: SponsorBlockCategory; label: string }[] = [
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'intro', label: 'Intro' },
  { value: 'outro', label: 'Outro' },
  { value: 'selfpromo', label: 'Self-promo' },
  { value: 'interaction', label: 'Interaction reminder' },
  { value: 'music_offtopic', label: 'Non-music section' },
];

const qualityLabelMap: Record<string, string> = {
  '4320p': '8K',
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
  advanced,
  setAdvanced,
  disabled,
}) => {
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('off');
  const [sponsorOpen, setSponsorOpen] = useState(false);

  const activeAudioFormat = AUDIO_FORMATS.find((f) => f.value === advanced.audioFormat);
  const isLossless = activeAudioFormat?.lossless ?? false;

  const toggleSponsorCategory = (cat: SponsorBlockCategory) => {
    const has = advanced.sponsorblockCategories.includes(cat);
    setAdvanced({
      ...advanced,
      sponsorblockCategories: has
        ? advanced.sponsorblockCategories.filter((c) => c !== cat)
        : [...advanced.sponsorblockCategories, cat],
    });
  };
  const qualities = videoInfo.availableQualities.map((q) => ({
    label: qualityLabelMap[q] || q,
    value: q,
  }));

  // Subtitle languages are already in videoInfo — derive them instead of
  // re-fetching (avoids a second full yt-dlp subprocess). Manual tracks first,
  // then automatic captions for codes not already covered.
  const subtitleLangs = useMemo(() => {
    const seen = new Set<string>();
    const merged: { code: string; name: string }[] = [];
    const add = (rec: Record<string, SubtitleTrack[]>) => {
      for (const [code, tracks] of Object.entries(rec)) {
        if (seen.has(code)) continue;
        seen.add(code);
        merged.push({ code, name: tracks[0]?.name || code });
      }
    };
    add(videoInfo.subtitles);
    add(videoInfo.automaticCaptions);
    return merged.length ? merged : [{ code: 'en', name: 'English' }];
  }, [videoInfo.subtitles, videoInfo.automaticCaptions]);

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

  const selectSx = {
    bgcolor: 'transparent',
    border: '2px solid',
    borderColor: 'text.primary',
    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
    fontFamily: 'Patrick Hand',
    fontSize: '1rem',
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '& .MuiSvgIcon-root': { color: 'text.primary' },
  };

  const selectMenuProps = {
    PaperProps: {
      sx: {
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
            <Audiotrack sx={{ mr: 0.75, fontSize: 18 }} /> Audio Only
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

      {/* Video codec */}
      {!audioOnly && (
        <Box>
          {sectionLabel('Codec', <CodecIcon />)}
          <ToggleButtonGroup
            value={advanced.videoCodec}
            exclusive
            fullWidth
            disabled={disabled}
            onChange={(_, v: VideoCodec | null) => { if (v) setAdvanced({ ...advanced, videoCodec: v }); }}
            sx={toggleGroupSx}
          >
            {CODEC_OPTIONS.map((c) => (
              <ToggleButton key={c.value} value={c.value}>{c.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}>
            {advanced.videoCodec === 'av1'
              ? 'AV1: smallest files, newest codec. Saved as .mkv.'
              : advanced.videoCodec === 'vp9'
              ? 'VP9: efficient, widely supported. Saved as .mkv.'
              : advanced.videoCodec === 'h264'
              ? 'H.264: most compatible with all players. Saved as .mp4.'
              : 'Auto: yt-dlp picks the best available codec.'}
          </Typography>
        </Box>
      )}

      {/* Audio format + bitrate + cover art */}
      {audioOnly && (
        <Box>
          {sectionLabel('Audio Format', <AudioFmtIcon />)}
          <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 160, flex: 1 }}>
              <Select
                value={advanced.audioFormat}
                disabled={disabled}
                onChange={(e) => setAdvanced({ ...advanced, audioFormat: e.target.value as AudioFormat })}
                sx={selectSx}
                MenuProps={selectMenuProps}
              >
                {AUDIO_FORMATS.map((f) => (
                  <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130, flex: 1 }}>
              <Select
                value={advanced.audioQuality}
                disabled={disabled || isLossless}
                onChange={(e) => setAdvanced({ ...advanced, audioQuality: e.target.value as AudioBitrate })}
                sx={{ ...selectSx, opacity: isLossless ? 0.5 : 1 }}
                MenuProps={selectMenuProps}
              >
                {BITRATES.map((b) => (
                  <MenuItem key={b} value={b}>{b} kbps</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <FormControlLabel
            sx={{ m: 0, mt: 1 }}
            control={
              <Checkbox
                checked={advanced.embedThumbnail}
                onChange={(e) => setAdvanced({ ...advanced, embedThumbnail: e.target.checked })}
                disabled={disabled}
                size="small"
                icon={<ThumbnailIcon />}
                checkedIcon={<ThumbnailIcon />}
                sx={{ color: 'text.secondary', '&.Mui-checked': { color: 'primary.main' } }}
              />
            }
            label={
              <Typography variant="caption" color="text.primary" sx={{ fontFamily: 'Patrick Hand', fontSize: '1rem' }}>
                Embed thumbnail as cover art
              </Typography>
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}>
            {isLossless ? 'Lossless format — bitrate is ignored.' : 'Pick a higher bitrate for better quality (larger files).'}
          </Typography>
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
                  disabled={disabled}
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

      {/* SponsorBlock — applies to both audio and video */}
      <Box>
        {sectionLabel('SponsorBlock', <SponsorIcon />)}
        <ToggleButtonGroup
          value={advanced.sponsorblockCategories.length > 0 ? 'on' : 'off'}
          exclusive
          fullWidth
          disabled={disabled}
          onChange={(_, v: string | null) => {
            if (!v) return;
            if (v === 'on') {
              setSponsorOpen(true);
              // Default to the safest, most-wanted category when enabling.
              if (advanced.sponsorblockCategories.length === 0) {
                setAdvanced({ ...advanced, sponsorblockCategories: ['sponsor'] });
              }
            } else {
              setAdvanced({ ...advanced, sponsorblockCategories: [] });
            }
          }}
          sx={toggleGroupSx}
        >
          <ToggleButton value="off">Off</ToggleButton>
          <ToggleButton value="on" onClick={() => setSponsorOpen(true)}>Remove segments</ToggleButton>
        </ToggleButtonGroup>

        <Collapse in={advanced.sponsorblockCategories.length > 0 && sponsorOpen} timeout={220}>
          <Box mt={1.5} display="flex" flexDirection="column" gap={0.25}>
            {SPONSORBLOCK_CATEGORIES.map((cat) => (
              <FormControlLabel
                key={cat.value}
                sx={{ m: 0 }}
                control={
                  <Checkbox
                    checked={advanced.sponsorblockCategories.includes(cat.value)}
                    onChange={() => toggleSponsorCategory(cat.value)}
                    disabled={disabled}
                    size="small"
                    sx={{ color: 'text.secondary', '&.Mui-checked': { color: 'primary.main' } }}
                  />
                }
                label={
                  <Typography variant="caption" color="text.primary" sx={{ fontFamily: 'Patrick Hand', fontSize: '1rem' }}>
                    {cat.label}
                  </Typography>
                }
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}>
            Selected segments are cut from the file using community SponsorBlock data.
          </Typography>
        </Collapse>
      </Box>
    </Box>
  );
};

export default FormatSelector;
