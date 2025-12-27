/**
 * Simplified Admin Panel
 * 3 tabs: Users, Groups, Data Access
 */

import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography, Paper } from '@mui/material';
import {
  People as PeopleIcon,
  Group as GroupIcon,
  Security as SecurityIcon
} from '@mui/icons-material';

import UsersManagement from './UsersManagement';
import GroupsManagement from './GroupsManagement';
import DataAccessManagement from './DataAccessManagement';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ paddingTop: '24px' }}>
      {value === index && children}
    </div>
  );
}

function Admin() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" gutterBottom className="dark:text-gray-200">
        Admin Panel
      </Typography>
      
      <Paper className="dark:bg-gray-800" sx={{ mt: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab
            icon={<PeopleIcon />}
            label="Users"
            iconPosition="start"
          />
          <Tab
            icon={<GroupIcon />}
            label="Groups"
            iconPosition="start"
          />
          <Tab
            icon={<SecurityIcon />}
            label="Data Access"
            iconPosition="start"
          />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <UsersManagement />
        </TabPanel>
        
        <TabPanel value={activeTab} index={1}>
          <GroupsManagement />
        </TabPanel>
        
        <TabPanel value={activeTab} index={2}>
          <DataAccessManagement />
        </TabPanel>
      </Paper>
    </Box>
  );
}

export default Admin;

