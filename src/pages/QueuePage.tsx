import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { DeleteSweep as ClearIcon, WarningAmber as WarningAmberIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueueStore } from '../store/queueStore';
import QueueItem from '../components/queue/QueueItem';
import { ErrorBoundary } from '../components/ErrorBoundary';

const QueuePage: React.FC = () => {
  const jobs = useQueueStore((s) => s.jobs);
  const clearCompleted = useQueueStore((s) => s.clearCompleted);
  const activeCount = useQueueStore((s) => s.activeCount);

  const hasCompleted = jobs.some(
    (j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled'
  );

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary" letterSpacing="-0.02em" sx={{ fontFamily: 'Kalam', transform: 'rotate(-2deg)' }}>
            Download Queue
          </Typography>
          <Typography variant="body2" color="text.disabled" mt={0.5}>
            {activeCount > 0
              ? `${activeCount} download${activeCount > 1 ? 's' : ''} in progress`
              : jobs.length > 0
              ? 'All downloads finished'
              : 'No downloads yet'}
          </Typography>
        </Box>

        {hasCompleted && (
          <Box
            component="button"
            className="sketch-button"
            onClick={clearCompleted}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 2,
              py: 0.75,
              fontSize: '0.95rem',
            }}
          >
            <ClearIcon sx={{ fontSize: 16 }} />
            Clear finished
          </Box>
        )}
      </Box>

      {/* Queue list */}
      {jobs.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 12,
            color: 'text.primary',
            border: '2px dashed',
            borderColor: 'text.primary',
            borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
            fontFamily: 'Patrick Hand',
          }}
        >
          <Typography variant="h2" sx={{ mb: 2, opacity: 0.8, color: 'primary.main', fontFamily: 'Kalam' }}>⬇</Typography>
          <Typography variant="h6" fontWeight={600} color="text.primary" mb={1} sx={{ fontFamily: 'Patrick Hand' }}>
            Your queue is empty
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Head to the Download page and add a video to get started.
          </Typography>
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" gap={1.5}>
          <AnimatePresence initial={false}>
            {jobs.map((job) => (
              <motion.div
                key={job.jobId}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                layout
              >
                {/* Per-item boundary: a single malformed job renders an inline
                    fallback instead of crashing the whole queue to the top-level
                    boundary. */}
                <ErrorBoundary
                  fallback={
                    <Box
                      sx={{
                        // Sketch card shell — matches QueueItem, red error accent
                        bgcolor: 'background.paper',
                        borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                        border: '2px solid #ff4d4d',
                        borderLeft: '5px solid #ff4d4d',
                        boxShadow: '4px 4px 0 0 rgba(255,77,77,0.4)',
                        transform: 'rotate(-0.6deg)',
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        fontFamily: 'Patrick Hand',
                      }}
                    >
                      <WarningAmberIcon sx={{ color: '#ff4d4d', fontSize: 28, flexShrink: 0 }} />
                      <Box minWidth={0}>
                        <Typography sx={{ fontFamily: 'Kalam', fontWeight: 700, color: '#ff4d4d', fontSize: '1.05rem', lineHeight: 1.2 }}>
                          Couldn't show this download
                        </Typography>
                        <Typography sx={{ fontFamily: 'Patrick Hand', color: 'text.secondary', fontSize: '0.95rem' }}>
                          Try "Clear finished" or reload the app.
                        </Typography>
                      </Box>
                    </Box>
                  }
                >
                  <QueueItem job={job} />
                </ErrorBoundary>
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>
      )}
    </Container>
  );
};

export default QueuePage;
