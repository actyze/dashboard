/**
 * Groups Management Component
 * Create groups, manage members
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon
} from '@mui/icons-material';
import AdminService from '../../services/AdminService';

function GroupsManagement() {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog state
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openMemberDialog, setOpenMemberDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsResp, usersResp] = await Promise.all([
        AdminService.listGroups(),
        AdminService.listUsers()
      ]);
      
      if (groupsResp.success) {
        setGroups(groupsResp.groups);
      }
      if (usersResp.success) {
        setUsers(usersResp.users);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setFormData({ name: '', description: '' });
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
  };

  const handleCreateGroup = async () => {
    try {
      const response = await AdminService.createGroup(formData);
      if (response.success) {
        setSuccess(`Group ${formData.name} created successfully`);
        handleCloseCreateDialog();
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create group');
    }
  };

  const handleOpenMemberDialog = (group) => {
    setSelectedGroup(group);
    setSelectedUserId('');
    setOpenMemberDialog(true);
  };

  const handleCloseMemberDialog = () => {
    setOpenMemberDialog(false);
    setSelectedGroup(null);
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !selectedGroup) return;
    
    try {
      const response = await AdminService.addGroupMember(selectedGroup.id, selectedUserId);
      if (response.success) {
        const user = users.find(u => u.id === selectedUserId);
        setSuccess(`Added ${user?.username} to ${selectedGroup.name}`);
        setSelectedUserId('');
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (groupId, userId, username) => {
    if (window.confirm(`Remove ${username} from this group?`)) {
      try {
        const response = await AdminService.removeGroupMember(groupId, userId);
        if (response.success) {
          setSuccess(`Removed ${username} from group`);
          loadData();
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to remove member');
      }
    }
  };

  // Get members for a group
  const getGroupMembers = (groupName) => {
    return users.filter(user => user.groups && user.groups.includes(groupName));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" className="dark:text-gray-200">
          Groups ({groups.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDialog}
        >
          Create Group
        </Button>
      </Box>

      {/* Groups Table */}
      <TableContainer component={Paper} className="dark:bg-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell className="dark:text-gray-200">Group Name</TableCell>
              <TableCell className="dark:text-gray-200">Description</TableCell>
              <TableCell className="dark:text-gray-200">Members</TableCell>
              <TableCell align="right" className="dark:text-gray-200">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => {
              const members = getGroupMembers(group.name);
              return (
                <TableRow key={group.id}>
                  <TableCell className="dark:text-gray-300">
                    <strong>{group.name}</strong>
                  </TableCell>
                  <TableCell className="dark:text-gray-300">
                    {group.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5} flexWrap="wrap" alignItems="center">
                      {members.length > 0 ? (
                        members.map((member) => (
                          <Chip
                            key={member.id}
                            label={member.username}
                            size="small"
                            onDelete={() => handleRemoveMember(group.id, member.id, member.username)}
                            deleteIcon={<PersonRemoveIcon />}
                          />
                        ))
                      ) : (
                        <Typography variant="caption" className="dark:text-gray-500">
                          No members
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<PersonAddIcon />}
                      onClick={() => handleOpenMemberDialog(group)}
                    >
                      Add Member
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Group Dialog */}
      <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="Group Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>Cancel</Button>
          <Button
            onClick={handleCreateGroup}
            variant="contained"
            disabled={!formData.name}
          >
            Create Group
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={openMemberDialog} onClose={handleCloseMemberDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add Member to {selectedGroup?.name}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <FormControl fullWidth>
              <InputLabel>Select User</InputLabel>
              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                label="Select User"
              >
                {users
                  .filter(user => !user.groups || !user.groups.includes(selectedGroup?.name))
                  .map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMemberDialog}>Cancel</Button>
          <Button
            onClick={handleAddMember}
            variant="contained"
            disabled={!selectedUserId}
          >
            Add Member
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GroupsManagement;

