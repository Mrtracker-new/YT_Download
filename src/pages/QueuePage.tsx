import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { DeleteSweep as ClearIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueueStore } from '../store/queueStore';
import QueueItem from '../components/queue/QueueItem';

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
                <QueueItem job={job} />
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>
      )}
    </Container>
  );
};

export default QueuePage;
