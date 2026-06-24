import React, { useEffect, useState } from 'react';
import {
  Box, Container, Typography, TextField, Slider,
  FormLabel, Switch, FormControlLabel, Select, MenuItem, FormControl,
  CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import {
  FolderOpen as FolderIcon,
  CheckCircle as OkIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Description as FileIcon,
  Clear as ClearIcon,
  OpenInNew as ExternalLinkIcon,
} from '@mui/icons-material';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useSettings } from '../hooks/useSettings';
import { checkBinaries, selectFolder, selectCookieFile } from '../services/tauriApi';
import { notify } from '../services/notifications';
import type { BinaryStatus } from '../types/settings';
import toast from 'react-hot-toast';

const SettingsPage: React.FC = () => {
  const { settings, save } = useSettings();
  const [local, setLocal] = React.useState(settings);
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatus | null>(null);
  const [checkingBinaries, setCheckingBinaries] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(settings); }, [settings]);

  const handleCheckBinaries = async () => {
    setCheckingBinaries(true);
    try {
      const status = await checkBinaries();
      setBinaryStatus(status);
    } catch {
      toast.error('Failed to check binaries');
    } finally {
      setCheckingBinaries(false);
    }
  };

  useEffect(() => { handleCheckBinaries(); }, []);

  const handleBrowseFolder = async () => {
    const folder = await selectFolder();
    if (folder) setLocal((prev) => ({ ...prev, downloadDir: folder }));
  };

  const handleBrowseCookieFile = async () => {
    const file = await selectCookieFile();
    if (file) setLocal((prev) => ({ ...prev, cookieFile: file }));
  };

  // Free, open-source extension that exports a Netscape cookies.txt in one click.
  const COOKIE_EXT_URL =
    'https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc';
  const openCookieExtension = async () => {
    try {
      await openUrl(COOKIE_EXT_URL);
    } catch {
      toast.error('Could not open browser');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(local);
      toast.success('Settings saved!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const sectionTitle = (title: string) => (
    <Typography
      variant="caption"
      color="text.disabled"
      fontWeight={700}
      sx={{ textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.1em' }}
    >
      {title}
    </Typography>
  );

  const BinaryChip: React.FC<{ name: string; found: boolean; version: string | null; path: string | null }> = ({
    name, found, version, path: _path,
  }) => (
    <Box
      sx={{
        p: 1.5,
        // Sketch card style — asymmetric wobbly corners
        borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
        border: '2px solid',
        borderColor: found ? '#10B981' : '#EF4444',
        bgcolor: found ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
        boxShadow: found
          ? '3px 3px 0 0 rgba(16,185,129,0.4)'
          : '3px 3px 0 0 rgba(239,68,68,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flex: 1,
        transform: found ? 'rotate(-0.5deg)' : 'rotate(0.5deg)',
        transition: 'transform 0.2s ease',
      }}
    >
      {found ? (
        <OkIcon sx={{ color: '#10B981', fontSize: 18 }} />
      ) : (
        <ErrorIcon sx={{ color: '#EF4444', fontSize: 18 }} />
      )}
      <Box flex={1} minWidth={0}>
        <Typography variant="caption" fontWeight={700} color="text.primary" display="block">
          {name}
        </Typography>
        <Typography variant="caption" color="text.disabled" fontSize="0.7rem" sx={{ wordBreak: 'break-all' }}>
          {found ? (version || 'found') : 'Not found — will be downloaded on first use'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} color="primary" letterSpacing="-0.02em" mb={1} sx={{ fontFamily: 'Kalam', transform: 'rotate(-2deg)' }}>
        Settings
      </Typography>
      <Typography variant="h6" color="text.secondary" mb={4} sx={{ fontFamily: 'Patrick Hand' }}>
        Configure download behavior and binary paths.
      </Typography>

      <Box display="flex" flexDirection="column" gap={4}>

        {/* Downloads */}
        <Box>
          {sectionTitle('Downloads')}
          <Box className="wobbly-card" sx={{ mt: 1.5, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <FormLabel sx={{ fontSize: '1rem', color: 'text.primary', display: 'block', mb: 1, fontFamily: 'Patrick Hand', fontWeight: 600 }}>
              Download Folder
            </FormLabel>
            <TextField
              fullWidth
              size="small"
              value={local.downloadDir || 'Default: ~/Downloads'}
              onChange={(e) => setLocal((p) => ({ ...p, downloadDir: e.target.value }))}
              placeholder="~/Downloads"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleBrowseFolder} sx={{ color: 'text.secondary' }}>
                      <FolderIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'transparent', fontFamily: 'Patrick Hand', fontSize: '1rem',
                  '& fieldset': { 
                    borderColor: 'text.primary', borderWidth: 2, borderStyle: 'solid',
                    borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                  },
                  '&:hover fieldset': { borderColor: 'primary.main' },
                  '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 3 },
                },
              }}
            />
            </Box>
            <Box mt={3}>
              <FormLabel sx={{ fontSize: '1rem', color: 'text.primary', display: 'block', mb: 0.5, fontFamily: 'Patrick Hand', fontWeight: 600 }}>
                Concurrent Downloads: {local.maxConcurrentDownloads}
              </FormLabel>
              <Slider
                value={local.maxConcurrentDownloads}
                min={1} max={5} step={1} marks
                onChange={(_, v) => setLocal((p) => ({ ...p, maxConcurrentDownloads: v as number }))}
                sx={{
                  color: 'primary.main',
                  '& .MuiSlider-thumb': {
                    width: 24, height: 24,
                    border: '2px solid',
                    borderColor: 'text.primary',
                    bgcolor: 'background.paper',
                    boxShadow: '1px 1px 0px rgba(0,0,0,0.5)',
                  },
                  '& .MuiSlider-markLabel': { color: 'text.secondary', fontSize: '0.9rem', fontFamily: 'Patrick Hand' },
                }}
              />
            </Box>

            <Box>
              <FormLabel sx={{ fontSize: '1rem', color: 'text.primary', display: 'block', mb: 1, fontFamily: 'Patrick Hand', fontWeight: 600 }}>
                File Naming Template
              </FormLabel>
              <TextField
                fullWidth size="small"
                value={local.fileNameTemplate}
                onChange={(e) => setLocal((p) => ({ ...p, fileNameTemplate: e.target.value }))}
                placeholder="%(title)s.%(ext)s"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'transparent', fontSize: '1rem', fontFamily: 'Patrick Hand',
                    '& fieldset': { 
                      borderColor: 'text.primary', borderWidth: 2, borderStyle: 'solid',
                      borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                    },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 3 },
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary" fontSize="0.8rem" mt={0.5} display="block" sx={{ fontFamily: 'Patrick Hand' }}>
                yt-dlp output template. Use %(title)s, %(uploader)s, %(id)s, %(ext)s, etc.
              </Typography>
            </Box>

            {/* Cookie Browser picker */}
            <Box>
              <FormLabel sx={{ fontSize: '1rem', color: 'text.primary', display: 'block', mb: 0.5, fontFamily: 'Patrick Hand', fontWeight: 600 }}>
                🍪 Cookie Browser
              </FormLabel>
              <Typography variant="caption" color="text.secondary" display="block" mb={1} sx={{ fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}>
                Only needed for private/login-required Instagram &amp; Twitter/X posts. Public videos work with None. Pick the browser you're signed into.
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={local.cookieBrowser ?? 'none'}
                  onChange={(e) => setLocal((p) => ({ ...p, cookieBrowser: e.target.value as any }))}
                  sx={{
                    fontFamily: 'Patrick Hand',
                    fontSize: '1rem',
                    bgcolor: 'transparent',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'text.primary',
                      borderWidth: 2,
                      borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 3 },
                    '& .MuiSelect-select': { fontFamily: 'Patrick Hand' },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: (theme) => ({
                        bgcolor: theme.palette.mode === 'dark' ? '#1c1917' : '#fdfbf7',
                        border: '2px solid',
                        borderColor: 'text.primary',
                        borderRadius: 2,
                        '& .MuiMenuItem-root': { fontFamily: 'Patrick Hand', fontSize: '1rem' },
                      }),
                    },
                  }}
                >
                  {[
                    { value: 'none',    label: '🚫 None (public videos only)' },
                    { value: 'chrome',  label: '🌐 Google Chrome' },
                    { value: 'edge',    label: '🌀 Microsoft Edge' },
                    { value: 'firefox', label: '🦊 Mozilla Firefox' },
                    { value: 'brave',   label: '🦁 Brave' },
                    { value: 'opera',   label: '🅾️ Opera' },
                    { value: 'safari',  label: '🧭 Safari (macOS only)' },
                  ].map(({ value, label }) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* cookies.txt file picker (bulletproof fallback) */}
            <Box>
              <FormLabel sx={{ fontSize: '1rem', color: 'text.primary', display: 'block', mb: 0.5, fontFamily: 'Patrick Hand', fontWeight: 600 }}>
                🗂️ cookies.txt File <Box component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>(advanced — most reliable)</Box>
              </FormLabel>
              <Typography variant="caption" color="text.secondary" display="block" mb={1} sx={{ fontFamily: 'Patrick Hand', fontSize: '0.85rem' }}>
                Use this when the Cookie Browser option fails (common on Windows with Chrome/Edge). A cookies.txt file always works and takes priority over the browser setting above.
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={local.cookieFile ?? ''}
                onChange={(e) => setLocal((p) => ({ ...p, cookieFile: e.target.value }))}
                placeholder="No file selected — using browser cookies"
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      {local.cookieFile ? (
                        <IconButton size="small" onClick={() => setLocal((p) => ({ ...p, cookieFile: '' }))} sx={{ color: 'text.secondary' }} title="Clear">
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                      <IconButton size="small" onClick={handleBrowseCookieFile} sx={{ color: 'text.secondary' }} title="Choose cookies.txt">
                        <FileIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'transparent', fontFamily: 'Patrick Hand', fontSize: '1rem',
                    '& fieldset': {
                      borderColor: 'text.primary', borderWidth: 2, borderStyle: 'solid',
                      borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                    },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 3 },
                  },
                }}
              />

              {/* How-to guide: one-click export, no editing required */}
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, border: '2px dashed', borderColor: 'text.secondary', opacity: 0.95 }}>
                <Typography variant="caption" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.9rem', fontWeight: 600, display: 'block', mb: 0.5 }}>
                  How to get a cookies.txt file (1 minute, no tech skills):
                </Typography>
                <Typography component="div" variant="caption" color="text.secondary" sx={{ fontFamily: 'Patrick Hand', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  1. Install the free <strong>“Get cookies.txt LOCALLY”</strong> browser extension.<br />
                  2. Log in to the site (Instagram, X, YouTube…) in that browser.<br />
                  3. Click the extension icon → <strong>Export</strong> → it saves a <code>cookies.txt</code>.<br />
                  4. Come back here and click the 📄 button to pick that file.
                </Typography>
                <IconButton
                  size="small"
                  onClick={openCookieExtension}
                  sx={{
                    mt: 1, px: 1.5, py: 0.5, borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                    border: '2px solid', borderColor: 'primary.main', color: 'primary.main',
                    fontFamily: 'Patrick Hand', fontSize: '0.85rem', gap: 0.5,
                  }}
                >
                  <ExternalLinkIcon fontSize="small" /> Get the extension
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Notifications & History */}
        <Box>
          {sectionTitle('Notifications & History')}
          <Box className="wobbly-card" sx={{ mt: 1.5, p: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5, transform: 'rotate(-0.5deg)' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={local.showNotifications}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setLocal((p) => ({ ...p, showNotifications: on }));
                    // Fire a test notification when enabling, so the user can confirm it works.
                    if (on) void notify('Notifications enabled', 'You will be notified when downloads finish.');
                  }}
                  size="small" sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'primary.main' } }}
                />
              }
              label={<Typography variant="body2" color="text.primary" sx={{ fontFamily: 'Patrick Hand', fontSize: '1.1rem' }}>Show desktop notifications</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={local.keepHistory}
                  onChange={(e) => setLocal((p) => ({ ...p, keepHistory: e.target.checked }))}
                  size="small" sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'primary.main' } }}
                />
              }
              label={<Typography variant="body2" color="text.primary" sx={{ fontFamily: 'Patrick Hand', fontSize: '1.1rem' }}>Keep download history</Typography>}
            />
          </Box>
        </Box>

        {/* Binaries */}
        <Box>
          {sectionTitle('Binaries')}
          <Box className="wobbly-card" sx={{ mt: 1.5, p: 2.5 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="body2" color="text.primary" sx={{ fontFamily: 'Patrick Hand', fontSize: '1.1rem', fontWeight: 600 }}>Binary Status</Typography>
              <IconButton size="small" onClick={handleCheckBinaries} disabled={checkingBinaries}
                sx={{ color: 'text.secondary' }}>
                {checkingBinaries ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </Box>

            {binaryStatus ? (
              <Box display="flex" gap={1.5}>
                <BinaryChip name="yt-dlp" found={binaryStatus.ytdlp.found} version={binaryStatus.ytdlp.version} path={binaryStatus.ytdlp.path} />
                <BinaryChip name="ffmpeg" found={binaryStatus.ffmpeg.found} version={binaryStatus.ffmpeg.version} path={binaryStatus.ffmpeg.path} />
              </Box>
            ) : (
              <Box display="flex" alignItems="center" justifyContent="center" py={2}>
                <CircularProgress size={24} sx={{ color: '#3B82F6' }} />
              </Box>
            )}

            {binaryStatus && (!binaryStatus.ytdlp.found || !binaryStatus.ffmpeg.found) && (
              <Box
                sx={{
                  mt: 2,
                  p: 1.5,
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                  bgcolor: 'rgba(59,130,246,0.06)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>ℹ️</Typography>
                <Typography variant="body2" color="primary.main" sx={{ fontFamily: 'Patrick Hand', fontSize: '1rem' }}>
                  Missing binaries will be downloaded automatically on your first download.
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                my: 2.5,
                borderBottom: '2px dashed',
                borderBottomColor: 'text.primary',
                opacity: 0.3,
              }}
            />

            <Typography variant="caption" color="text.primary" display="block" mb={1.5} fontWeight={600} sx={{ fontFamily: 'Patrick Hand', fontSize: '1rem' }}>
              Override Paths (leave empty for auto-detection)
            </Typography>

            <Box display="flex" flexDirection="column" gap={1.5}>
              {[
                { label: 'yt-dlp Path', key: 'ytdlpPath' as const, placeholder: 'e.g. C:\\tools\\yt-dlp.exe' },
                { label: 'ffmpeg Path', key: 'ffmpegPath' as const, placeholder: 'e.g. C:\\tools\\ffmpeg.exe' },
              ].map(({ label, key, placeholder }) => (
                <Box key={key}>
                  <FormLabel sx={{ fontSize: '1rem', color: 'text.primary', display: 'block', mb: 0.75, fontFamily: 'Patrick Hand' }}>
                    {label}
                  </FormLabel>
                  <TextField
                    fullWidth size="small"
                    value={local[key]}
                    onChange={(e) => setLocal((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'transparent', fontSize: '1rem', fontFamily: 'Patrick Hand',
                        '& fieldset': { 
                          borderColor: 'text.primary', borderWidth: 2, borderStyle: 'solid',
                          borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                        },
                        '&:hover fieldset': { borderColor: 'primary.main' },
                        '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 3 },
                      },
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Save */}
        <Box
          component="button"
          className="sketch-button"
          onClick={handleSave}
          disabled={saving}
          sx={{
            py: 1.5,
            width: '100%',
            mt: 2,
          }}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </Box>
      </Box>
    </Container>
  );
};

export default SettingsPage;
