import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  Link as LinkIcon,
  Clear as ClearIcon,
  ContentPaste as PasteIcon,
} from '@mui/icons-material';
import { isValidUrl, isPlaylistUrl } from '../../utils/validators';

interface VideoInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
}

const VideoInput: React.FC<VideoInputProps> = ({ onSubmit, isLoading, error, onClear }) => {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-paste from clipboard on mount if clipboard contains a URL
  useEffect(() => {
    const tryAutoPaste = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && isValidUrl(text.trim())) {
          setUrl(text.trim());
        }
      } catch {
        // Clipboard read denied — that's fine
      }
    };
    tryAutoPaste();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    if (urlError) setUrlError('');
  };

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('Please enter a URL');
      return;
    }
    if (!isValidUrl(trimmed)) {
      setUrlError('Unsupported URL. Paste a YouTube, Vimeo, SoundCloud or similar link.');
      return;
    }
    setUrlError('');
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setUrlError('');
        inputRef.current?.focus();
      }
    } catch {
      // Permission denied
    }
  };

  const handleClear = () => {
    setUrl('');
    setUrlError('');
    onClear();
    inputRef.current?.focus();
  };

  const isPlaylist = isPlaylistUrl(url);

  return (
    <Box>
      <TextField
        inputRef={inputRef}
        fullWidth
        value={url}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Paste a YouTube, Vimeo, SoundCloud or other URL…"
        error={!!(urlError || error)}
        helperText={urlError || error || ' '}
        disabled={isLoading}
        variant="outlined"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {isLoading ? (
                <CircularProgress size={18} sx={{ color: 'primary.main' }} />
              ) : (
                <LinkIcon sx={{ color: url ? 'primary.main' : 'text.disabled', fontSize: 20 }} />
              )}
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <Box display="flex" gap={0.5}>
                {url ? (
                  <IconButton
                    size="small"
                    onClick={handleClear}
                    disabled={isLoading}
                    sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                ) : (
                  <IconButton
                    size="small"
                    onClick={handlePaste}
                    sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                    title="Paste from clipboard"
                  >
                    <PasteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'transparent',
            fontFamily: 'Patrick Hand',
            fontSize: '1.2rem',
            transition: 'all 0.2s ease',
            '& fieldset': {
              borderColor: urlError || error ? '#EF4444' : 'text.primary',
              borderWidth: 2,
              borderStyle: 'solid',
              borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
              transition: 'all 0.2s ease',
            },
            '&:hover fieldset': {
              borderColor: urlError || error ? '#EF4444' : 'primary.main',
            },
            '&.Mui-focused fieldset': {
              borderColor: urlError || error ? '#EF4444' : 'primary.main',
              borderWidth: 3,
            },
            '&.Mui-disabled fieldset': {
              borderColor: 'text.disabled',
            },
          },
          '& .MuiFormHelperText-root': {
            color: urlError || error ? '#EF4444' : 'transparent',
            fontFamily: 'Patrick Hand',
            fontSize: '0.9rem',
            mt: 0.75,
            ml: 0.5,
            minHeight: '1.2em',
          },
        }}
      />

      {/* Playlist indicator */}
      {isPlaylist && !urlError && (
        <Box mt={-1} mb={1} display="flex" alignItems="center" gap={1}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 1.25,
              py: 0.3,
              bgcolor: 'transparent',
              color: 'primary.main',
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
              fontFamily: 'Patrick Hand',
              fontSize: '0.88rem',
              fontWeight: 700,
              lineHeight: 1.4,
              boxShadow: '2px 2px 0 0 rgba(59,130,246,0.35)',
              transform: 'rotate(-0.5deg)',
              whiteSpace: 'nowrap',
            }}
          >
            🎵 Playlist detected
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.8rem' }}>
            Use the Playlist page to select individual items
          </Typography>
        </Box>
      )}

      {/* Fetch button */}
      <Box
        component="button"
        className="sketch-button"
        onClick={handleSubmit}
        disabled={isLoading || !url.trim()}
        sx={{
          mt: 2,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        {isLoading ? (
          <>
            <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.5)' }} />
            Fetching info…
          </>
        ) : (
          'Fetch Video Info'
        )}
      </Box>
    </Box>
  );
};

export default VideoInput;
