import React from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { AppUpdateBanner } from '../updater';

const AppLayout: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppUpdateBanner />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: 'transparent',
          // Custom scrollbar
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,0,0,0.1)',
            borderRadius: 4,
            border: '1px solid rgba(0,0,0,0.05)',
            '&:hover': { background: 'rgba(0,0,0,0.2)' },
          },
          '.dark-mode &::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.05)',
            '&:hover': { background: 'rgba(255,255,255,0.2)' },
          }
        }}
      >
        <Outlet />
      </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;
