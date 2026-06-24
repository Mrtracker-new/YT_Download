import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Box, Typography, Tooltip, Badge } from '@mui/material';
import {
  Download as DownloadIcon,
  PlaylistPlay as QueueIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  List as PlaylistIcon,
} from '@mui/icons-material';
import { useQueueStore } from '../../store/queueStore';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactElement;
  badgeCount?: number;
}

const Sidebar: React.FC = () => {
  const location = useLocation();
  const jobs = useQueueStore((s) => s.jobs);
  const activeCount = jobs.filter(
    (j) => j.status === 'downloading' || j.status === 'queued'
  ).length;

  const navItems: NavItem[] = [
    { path: '/', label: 'Download', icon: <DownloadIcon /> },
    { path: '/queue', label: 'Queue', icon: <QueueIcon />, badgeCount: activeCount },
    { path: '/playlist', label: 'Playlist', icon: <PlaylistIcon /> },
    { path: '/history', label: 'History', icon: <HistoryIcon /> },
    { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  return (
    <Box
      component="nav"
      sx={{
        width: 80,
        minWidth: 80,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 3,
        gap: 2,
        background: 'transparent',
        borderRight: '2px dashed rgba(0,0,0,0.2)',
        '.dark-mode &': {
          borderRight: '2px dashed rgba(255,255,255,0.15)',
        },
        zIndex: 10,
        position: 'relative',
        '&::after': {
           content: '""',
           position: 'absolute',
           right: -4,
           top: 0,
           height: '100%',
           width: 2,
           backgroundColor: 'rgba(0,0,0,0.05)',
           '.dark-mode &': { backgroundColor: 'rgba(255,255,255,0.05)' }
        }
      }}
    >
      {/* Logo */}
      <Box
        className="wobbly-card"
        sx={{
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
          backgroundColor: 'transparent',
          transform: 'rotate(-3deg)',
        }}
      >
        <img src="/icon.png" alt="YT Downloader" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </Box>

      {/* Nav items */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, width: '100%', px: 1 }}>
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          return (
            <Tooltip key={item.path} title={item.label} placement="right">
              <NavLink
                to={item.path}
                style={{ textDecoration: 'none' }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: 54,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    color: isActive ? '#ff4d4d' : 'inherit',
                    opacity: isActive ? 1 : 0.6,
                    fontFamily: '"Patrick Hand", cursive',
                    '&:hover': {
                      opacity: 1,
                      transform: 'rotate(2deg) scale(1.05)',
                    },
                    // Marker highlight for active
                    '&::before': isActive
                      ? {
                          content: '""',
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%) rotate(-2deg)',
                          width: '80%',
                          height: '90%',
                          bgcolor: 'rgba(255, 77, 77, 0.15)',
                          borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                          zIndex: -1,
                          border: '1px solid rgba(255, 77, 77, 0.3)',
                        }
                      : {},
                  }}
                >
                  {item.badgeCount ? (
                    <Badge
                      badgeContent={item.badgeCount}
                      sx={{
                        '& .MuiBadge-badge': {
                          fontSize: '0.6rem',
                          fontFamily: 'Kalam',
                          minWidth: 18,
                          height: 18,
                          bgcolor: '#ff4d4d',
                          color: '#fff',
                          border: '1px solid #2d2d2d',
                          borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px',
                        },
                      }}
                    >
                      {React.cloneElement(item.icon, { sx: { fontSize: 24 } })}
                    </Badge>
                  ) : (
                    React.cloneElement(item.icon, { sx: { fontSize: 24 } })
                  )}
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1, fontFamily: 'inherit' }}>
                    {item.label}
                  </Typography>
                </Box>
              </NavLink>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

export default Sidebar;
