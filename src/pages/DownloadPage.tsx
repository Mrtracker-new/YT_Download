import React, { useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import VideoInput from '../components/downloader/VideoInput';
import VideoPreview from '../components/downloader/VideoPreview';
import FormatSelector from '../components/downloader/FormatSelector';
import { useDownload } from '../hooks/useDownload';
import type { SubtitleOptions } from '../types/video';

const DEFAULT_SUBTITLE_OPTIONS: SubtitleOptions = {
  enabled: false,
  language: 'en',
  mode: 'embed',
  includeAuto: true,
};

const DownloadPage: React.FC = () => {
  const navigate = useNavigate();
  const { videoInfo, isFetching, fetchError, fetchVideoInfo, queueDownload, clearVideoInfo } =
    useDownload();

  const [audioOnly, setAudioOnly] = useState(false);
  const [quality, setQuality] = useState('720p');
  const [subtitleOptions, setSubtitleOptions] = useState<SubtitleOptions>(DEFAULT_SUBTITLE_OPTIONS);
  const [isQueuing, setIsQueuing] = useState(false);

  // Store the URL the user submitted — needed for download since VideoInfo
  // only contains the video ID, not the original platform URL.
  // Constructing https://youtube.com/watch?v=<ID> here was the root cause of
  // "Incomplete YouTube ID" errors for Vimeo and other platforms.
  const [fetchedUrl, setFetchedUrl] = useState('');

  const handleFetch = async (url: string) => {
    setFetchedUrl(url); // remember the original URL for download
    const info = await fetchVideoInfo(url);
    if (info && info.availableQualities.length > 0) {
      // Default to best quality that isn't 4K (usually 1080p or highest available)
      const preferred = ['1080p', '720p', '480p'];
      const best = preferred.find((q) => info.availableQualities.includes(q));
      setQuality(best || info.availableQualities[0]);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo || !fetchedUrl) return;
    setIsQueuing(true);
    try {
      // Use the original URL — never reconstruct from videoId which is platform-specific
      await queueDownload({ url: fetchedUrl, quality, audioOnly, subtitleOptions });
      toast.success('Added to download queue!', { icon: '✅' });
      navigate('/queue');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to start download');
    } finally {
      setIsQueuing(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      {/* Hero header */}
      <Box textAlign="center" mb={5}>
        <Typography
          variant="h3"
          component="h1"
          color="primary"
          sx={{
            mb: 1.5,
            letterSpacing: '1px',
            textShadow: '3px 3px 0px rgba(0,0,0,0.2)',
            transform: 'rotate(-2deg)',
            display: 'inline-block',
          }}
        >
          Download Anything!
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          maxWidth={500}
          mx="auto"
          sx={{ fontFamily: 'Patrick Hand', transform: 'rotate(0.5deg)', display: 'block' }}
        >
          Paste a URL from YouTube, Vimeo, SoundCloud, and 1000+ other sites. Runs fully offline — no server, no cloud.
        </Typography>
      </Box>

      {/* URL Input */}
      <Box
        className="wobbly-card"
        sx={{
          p: 3,
          mb: 4,
          transform: 'rotate(1deg)',
        }}
      >
        <VideoInput
          onSubmit={handleFetch}
          isLoading={isFetching}
          error={fetchError}
          onClear={clearVideoInfo}
        />
      </Box>

      {/* Video info + controls */}
      <AnimatePresence>
        {videoInfo && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Box
              className="wobbly-card"
              sx={{
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                transform: 'rotate(-0.5deg)',
              }}
            >
              <VideoPreview videoInfo={videoInfo} />

              <Box
                sx={{
                  borderBottom: '2px dashed',
                  borderBottomColor: 'text.primary',
                  opacity: 0.25,
                }}
              />

              <FormatSelector
                videoInfo={videoInfo}
                audioOnly={audioOnly}
                setAudioOnly={setAudioOnly}
                quality={quality}
                setQuality={setQuality}
                subtitleOptions={subtitleOptions}
                setSubtitleOptions={setSubtitleOptions}
                disabled={isQueuing}
              />

              {/* Download button */}
              <Box
                component="button"
                className="sketch-button"
                onClick={handleDownload}
                disabled={isQueuing}
                sx={{
                  py: 1.5,
                  mt: 2,
                  width: '100%',
                }}
              >
                {isQueuing
                  ? 'Adding to queue…'
                  : `Download ${audioOnly ? 'Audio (MP3)' : `${quality} Video`}`}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default DownloadPage;
