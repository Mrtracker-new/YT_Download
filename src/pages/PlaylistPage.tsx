import React, { useState } from 'react';
import {
  Box, Container, Typography, TextField, InputAdornment,
  IconButton, CircularProgress, Checkbox, Button, Chip,
} from '@mui/material';
import { Link as LinkIcon, Clear as ClearIcon, ContentPaste as PasteIcon, Add as AddIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { getPlaylistInfo, startDownload } from '../services/tauriApi';
import { useQueueStore } from '../store/queueStore';
import { isValidUrl } from '../utils/validators';
import { formatDuration, truncate } from '../utils/formatters';
import type { PlaylistInfo } from '../types/video';
import type { DownloadJob } from '../types/download';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const PlaylistPage: React.FC = () => {
  const navigate = useNavigate();
  const addJob = useQueueStore((s) => s.addJob);

  const [url, setUrl] = useState('');
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [audioOnly, setAudioOnly] = useState(false);
  const [quality, setQuality] = useState('720p');
  const [isQueuing, setIsQueuing] = useState(false);

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed || !isValidUrl(trimmed)) {
      setFetchError('Please enter a valid playlist URL');
      return;
    }
    setIsFetching(true);
    setFetchError(null);
    setPlaylistInfo(null);
    setSelected(new Set());
    try {
      const info = await getPlaylistInfo(trimmed);
      setPlaylistInfo(info);
      // Select all by default
      setSelected(new Set(info.entries.map((e) => e.id)));
    } catch (err) {
      // Tauri commands return Err(String) as a raw string rejection, not an Error object
      const msg = typeof err === 'string'
        ? err
        : (err instanceof Error ? err.message : null) ?? 'Failed to fetch playlist info';
      setFetchError(msg);
    } finally {
      setIsFetching(false);
    }
  };

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!playlistInfo) return;
    if (selected.size === playlistInfo.entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(playlistInfo.entries.map((e) => e.id)));
    }
  };

  const handleQueueSelected = async () => {
    if (!playlistInfo || selected.size === 0) return;
    setIsQueuing(true);
    const toQueue = playlistInfo.entries.filter((e) => selected.has(e.id));
    let queued = 0;
    for (const item of toQueue) {
      try {
        const jobId = await startDownload({
          url: item.url,
          quality,
          audioOnly,
          subtitleOptions: { enabled: false, language: 'en', mode: 'embed', includeAuto: false },
        });
        const job: DownloadJob = {
          jobId,
          url: item.url,
          title: item.title,
          thumbnail: item.thumbnail,
          uploader: item.uploader,
          duration: item.duration,
          quality,
          audioOnly,
          subtitleOptions: { enabled: false, language: 'en', mode: 'embed', includeAuto: false },
          format: audioOnly ? 'mp3' : 'mp4',
          status: 'queued',
          progress: 0,
          speed: '',
          eta: '',
          createdAt: Date.now(),
        };
        addJob(job);
        queued++;
      } catch {
        // continue with others
      }
    }
    setIsQueuing(false);
    toast.success(`${queued} item${queued !== 1 ? 's' : ''} added to queue!`);
    navigate('/queue');
  };

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} color="primary" letterSpacing="-0.02em" mb={1} sx={{ fontFamily: 'Kalam', transform: 'rotate(-2deg)' }}>
        Playlist Download
      </Typography>
      <Typography variant="h6" color="text.secondary" mb={4} sx={{ fontFamily: 'Patrick Hand' }}>
        Paste a YouTube playlist URL, select items, and queue them all at once.
      </Typography>

      {/* URL input */}
      <Box className="wobbly-card" sx={{ p: 3, mb: 3, transform: 'rotate(1deg)' }}>
        <TextField
          fullWidth value={url}
          onChange={(e) => { setUrl(e.target.value); setFetchError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          placeholder="https://www.youtube.com/playlist?list=..."
          error={!!fetchError}
          helperText={fetchError || ' '}
          disabled={isFetching}
          InputProps={{
            startAdornment: <InputAdornment position="start"><LinkIcon sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment>,
            endAdornment: url ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => { setUrl(''); setPlaylistInfo(null); setFetchError(null); }}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : (
              <InputAdornment position="end">
                <IconButton size="small" onClick={async () => { const t = await navigator.clipboard.readText(); if (t) setUrl(t.trim()); }}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                  <PasteIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'transparent', fontFamily: 'Patrick Hand', fontSize: '1.2rem',
              transition: 'all 0.2s ease',
              '& fieldset': { 
                borderColor: fetchError ? '#EF4444' : 'text.primary',
                borderWidth: 2, borderStyle: 'solid',
                borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                transition: 'all 0.2s ease',
              },
              '&:hover fieldset': { borderColor: fetchError ? '#EF4444' : 'primary.main' },
              '&.Mui-focused fieldset': { borderColor: fetchError ? '#EF4444' : 'primary.main', borderWidth: 3 },
            },
            '& .MuiFormHelperText-root': { color: fetchError ? '#EF4444' : 'transparent', ml: 0.5, fontFamily: 'Patrick Hand' },
          }}
        />

        <Box component="button" className="sketch-button" onClick={handleFetch} disabled={isFetching || !url.trim()} sx={{
          mt: 2, width: '100%', py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
        }}>
          {isFetching ? <><CircularProgress size={16} sx={{ color: 'text.secondary' }} /> Fetching playlist…</> : 'Fetch Playlist'}
        </Box>
      </Box>

      {/* Playlist items */}
      <AnimatePresence>
        {playlistInfo && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {/* Playlist header */}
            <Box className="tape-decoration relative" sx={{ p: 2.5, bgcolor: 'background.paper', border: '2px solid', borderColor: 'text.primary', borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px', mb: 2, transform: 'rotate(-0.5deg)', boxShadow: '4px 4px 0 0 rgba(45,45,45,0.85)' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ fontFamily: 'Kalam' }}>
                    {truncate(playlistInfo.title, 60)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '1rem' }}>
                    {playlistInfo.uploader} · {playlistInfo.entryCount} videos
                  </Typography>
                </Box>
                <Chip
                  label={`${selected.size} selected`}
                  size="small"
                  sx={{ bgcolor: 'transparent', color: 'primary.main', border: '2px solid', borderColor: 'primary.main', borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px', fontFamily: 'Patrick Hand', fontSize: '0.9rem' }}
                />
              </Box>

              {/* Options row */}
              <Box display="flex" gap={2} mt={2} alignItems="center" flexWrap="wrap">
                <Box display="flex" gap={1}>
                  {['720p', '1080p', '480p', '360p'].map((q) => (
                    <Button key={q} size="small" onClick={() => setQuality(q)}
                      sx={{
                        borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px', py: 0.5, px: 1.5, fontSize: '0.9rem', fontWeight: 600,
                        border: '2px solid', minWidth: 0, fontFamily: 'Patrick Hand',
                        borderColor: quality === q ? 'primary.main' : 'text.primary',
                        bgcolor: quality === q ? 'primary.main' : 'transparent',
                        color: quality === q ? '#fff' : 'text.primary',
                        transform: quality === q ? 'rotate(-2deg)' : 'none',
                        boxShadow: quality === q ? '1px 2px 0px rgba(0,0,0,0.5)' : 'none',
                      }}>
                      {q}
                    </Button>
                  ))}
                </Box>
                <Button size="small" onClick={() => setAudioOnly(!audioOnly)}
                  sx={{
                    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px', py: 0.5, px: 1.5, fontSize: '0.9rem', fontWeight: 600, border: '2px solid', minWidth: 0, fontFamily: 'Patrick Hand',
                    borderColor: audioOnly ? 'primary.main' : 'text.primary',
                    bgcolor: audioOnly ? 'primary.main' : 'transparent',
                    color: audioOnly ? '#fff' : 'text.primary',
                    transform: audioOnly ? 'rotate(2deg)' : 'none',
                    boxShadow: audioOnly ? '1px 2px 0px rgba(0,0,0,0.5)' : 'none',
                  }}>
                  {audioOnly ? '🎵 Audio Only' : '🎬 Video'}
                </Button>
              </Box>
            </Box>

            {/* Select all + items */}
            <Box className="wobbly-card" sx={{ p: 2, mb: 2, transform: 'rotate(0.5deg)' }}>
              <Box display="flex" alignItems="center" gap={1} mb={1.5} pb={1.5} sx={{ borderBottom: '2px dashed', borderBottomColor: 'text.primary' }}>
                <Checkbox
                  checked={selected.size === playlistInfo.entries.length}
                  indeterminate={selected.size > 0 && selected.size < playlistInfo.entries.length}
                  onChange={toggleAll} size="small"
                  sx={{ color: 'text.primary', '&.Mui-checked': { color: 'primary.main' }, p: 0 }}
                />
                <Typography variant="body1" color="text.primary" fontWeight={600} sx={{ fontFamily: 'Patrick Hand' }}>
                  Select all ({playlistInfo.entries.length} items)
                </Typography>
              </Box>

              <Box display="flex" flexDirection="column" gap={0.75} maxHeight={400} overflow="auto"
                sx={{ '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 2, '.dark-mode &': { bgcolor: 'rgba(255,255,255,0.1)' } } }}>
                {playlistInfo.entries.map((item, idx) => (
                  <Box key={item.id} display="flex" alignItems="center" gap={1.5} py={0.75}
                    sx={{ borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px', px: 0.5, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', '.dark-mode &': { bgcolor: 'rgba(255,255,255,0.05)' } } }}
                    onClick={() => toggleItem(item.id)}>
                    <Checkbox
                      checked={selected.has(item.id)} size="small"
                      sx={{ color: 'text.secondary', '&.Mui-checked': { color: 'primary.main' }, p: 0, flexShrink: 0 }}
                      onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ width: 24, flexShrink: 0, textAlign: 'right', fontFamily: 'Patrick Hand', fontSize: '1rem' }}>
                      {idx + 1}
                    </Typography>
                    {item.thumbnail && (
                      <Box component="img" src={item.thumbnail} alt={item.title}
                        sx={{ width: 48, height: 27, border: '2px solid', borderColor: 'text.primary', borderRadius: '2px', objectFit: 'cover', flexShrink: 0, opacity: selected.has(item.id) ? 1 : 0.4 }} />
                    )}
                    <Box flex={1} minWidth={0}>
                      <Typography variant="body1" fontSize="1rem" fontWeight={500}
                        sx={{ opacity: selected.has(item.id) ? 1 : 0.5, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: 'Patrick Hand' }}>
                        {item.title}
                      </Typography>
                      {item.duration && (
                        <Typography variant="caption" color="text.secondary" fontSize="0.8rem" sx={{ fontFamily: 'Patrick Hand' }}>
                          {formatDuration(item.duration)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Queue button */}
            <Box component="button" className="sketch-button" onClick={handleQueueSelected}
              disabled={isQueuing || selected.size === 0}
              sx={{
                width: '100%', py: 1.5, mt: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
              }}>
              <AddIcon />
              {isQueuing ? 'Queuing…' : `Queue ${selected.size} Download${selected.size !== 1 ? 's' : ''}`}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default PlaylistPage;
