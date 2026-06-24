import React, { useEffect, useState } from 'react';
import {
  Box, Container, Typography, IconButton, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Button,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  DeleteSweep as ClearIcon,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { getHistory, deleteHistoryItem, clearHistory, openFolder } from '../services/tauriApi';
import type { DownloadJob } from '../types/download';
import { formatDate, formatDuration, formatFileSize, truncate } from '../utils/formatters';

const HistoryPage: React.FC = () => {
  const [items, setItems] = useState<DownloadJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory(0, 100)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (jobId: string) => {
    await deleteHistoryItem(jobId);
    setItems((prev) => prev.filter((i) => i.jobId !== jobId));
  };

  const handleClear = async () => {
    await clearHistory();
    setItems([]);
  };

  const handleOpenFolder = async (filePath: string) => {
    const dir = filePath.substring(0, filePath.lastIndexOf('\\'));
    await openFolder(dir);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary" letterSpacing="-0.02em" sx={{ fontFamily: 'Kalam', transform: 'rotate(-2deg)' }}>
            Download History
          </Typography>
          <Typography variant="h6" color="text.secondary" mt={0.5} sx={{ fontFamily: 'Patrick Hand' }}>
            {items.length} completed download{items.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        {items.length > 0 && (
          <Button
            size="small"
            className="sketch-button"
            startIcon={<ClearIcon />}
            onClick={handleClear}
            sx={{
              py: 0.5,
              fontSize: '0.9rem',
            }}
          >
            Clear all
          </Button>
        )}
      </Box>

      {loading ? (
        <Box textAlign="center" py={10} color="text.disabled">
          <Typography>Loading history…</Typography>
        </Box>
      ) : items.length === 0 ? (
        <Box
          textAlign="center"
          py={12}
          color="text.primary"
          sx={{
            border: '2px dashed',
            borderColor: 'text.primary',
            borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
            fontFamily: 'Patrick Hand',
          }}
        >
          <Typography variant="h2" sx={{ mb: 2, opacity: 0.8, color: 'primary.main', fontFamily: 'Kalam' }}>📋</Typography>
          <Typography variant="h6" fontWeight={600} color="text.primary" mb={1} sx={{ fontFamily: 'Patrick Hand' }}>
            No download history yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Completed downloads will appear here.
          </Typography>
        </Box>
      ) : (
        <Box
          className="wobbly-card"
          sx={{
            overflow: 'hidden',
            p: 2,
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'transparent' }}>
                {['Video', 'Format', 'Size', 'Date', ''].map((h) => (
                  <TableCell
                    key={h}
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.9rem',
                      fontFamily: 'Kalam',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      borderBottom: '2px dashed',
                      borderBottomColor: 'text.primary',
                      py: 1.5,
                    }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.jobId}
                  sx={{
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' },
                    '& td': { borderBottom: '1px solid rgba(0,0,0,0.1)', fontFamily: 'Patrick Hand', fontSize: '1rem' },
                    '.dark-mode & td': { borderBottom: '1px solid rgba(255,255,255,0.1)' }
                  }}
                >
                  {/* Video info */}
                  <TableCell sx={{ py: 1.5 }}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      {item.thumbnail && (
                        <Box
                          sx={{
                            flexShrink: 0,
                            bgcolor: '#fff',
                            p: '3px',
                            pb: '8px',
                            border: '1px solid rgba(0,0,0,0.12)',
                            boxShadow: '1px 2px 4px rgba(0,0,0,0.15)',
                            transform: 'rotate(-1.5deg)',
                            borderRadius: '2px',
                          }}
                        >
                          <Box
                            component="img"
                            src={item.thumbnail}
                            sx={{ width: 48, height: 27, display: 'block', objectFit: 'cover' }}
                          />
                        </Box>
                      )}
                      <Box>
                        <Typography variant="body2" fontWeight={600} fontSize="0.82rem">
                          {truncate(item.title, 50)}
                        </Typography>
                        {item.uploader && (
                          <Typography variant="caption" color="text.disabled" fontSize="0.7rem">
                            {item.uploader}
                            {item.duration ? ` · ${formatDuration(item.duration)}` : ''}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Format */}
                  <TableCell sx={{ py: 1.5 }}>
                    <Chip
                      size="small"
                      label={item.audioOnly ? '🎵 MP3' : `📹 ${item.quality} MP4`}
                      sx={{
                        height: 22,
                        fontSize: '0.72rem',
                        fontFamily: 'Patrick Hand',
                        fontWeight: 700,
                        bgcolor: 'transparent',
                        color: item.audioOnly ? '#A78BFA' : '#60A5FA',
                        border: `2px solid ${item.audioOnly ? '#A78BFA' : '#60A5FA'}`,
                        borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  </TableCell>

                  {/* File size */}
                  <TableCell sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" fontSize="0.78rem">
                      {item.fileSize ? formatFileSize(item.fileSize) : '—'}
                    </Typography>
                  </TableCell>

                  {/* Date */}
                  <TableCell sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.disabled" fontSize="0.75rem">
                      {formatDate(item.completedAt || item.createdAt)}
                    </Typography>
                  </TableCell>

                  {/* Actions */}
                  <TableCell sx={{ py: 1.5 }}>
                    <Box display="flex" gap={0.5}>
                      {item.filePath && (
                        <Tooltip title="Open folder">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenFolder(item.filePath!)}
                            sx={{ color: 'text.disabled', '&:hover': { color: '#10B981' } }}
                          >
                            <FolderIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete from history">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(item.jobId)}
                          sx={{ color: 'text.disabled', '&:hover': { color: '#EF4444' } }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Container>
  );
};

export default HistoryPage;
