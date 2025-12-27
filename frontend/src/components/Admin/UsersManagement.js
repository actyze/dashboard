/**
 * Users Management Component
 * Create users, set role (ADMIN/USER), assign to groups, deactivate
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import AdminService from '../../services/AdminService';

function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'USER'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await AdminService.listUsers();
      if (response.success) {
        setUsers(response.users);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      role: 'USER'
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleCreateUser = async () => {
    try {
      const response = await AdminService.createUser(formData);
      if (response.success) {
        setSuccess(`User ${formData.username} created successfully`);
        handleCloseDialog();
        loadUsers();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleSetRole = async (userId, newRole) => {
    try {
      const response = await AdminService.setUserRole(userId, newRole);
      if (response.success) {
        setSuccess(`User role updated to ${newRole}`);
        loadUsers();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDeactivate = async (userId, username) => {
    if (window.confirm(`Are you sure you want to deactivate ${username}?`)) {
      try {
        const response = await AdminService.deactivateUser(userId);
        if (response.success) {
          setSuccess(`User ${username} deactivated`);
          loadUsers();
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to deactivate user');
      }
    }
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
          Users ({users.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Create User
        </Button>
      </Box>

      {/* Users Table */}
      <TableContainer component={Paper} className="dark:bg-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell className="dark:text-gray-200">Username</TableCell>
              <TableCell className="dark:text-gray-200">Email</TableCell>
              <TableCell className="dark:text-gray-200">Full Name</TableCell>
              <TableCell className="dark:text-gray-200">Role</TableCell>
              <TableCell className="dark:text-gray-200">Groups</TableCell>
              <TableCell align="right" className="dark:text-gray-200">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="dark:text-gray-300">{user.username}</TableCell>
                <TableCell className="dark:text-gray-300">{user.email}</TableCell>
                <TableCell className="dark:text-gray-300">{user.full_name || '-'}</TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={user.role}
                      onChange={(e) => handleSetRole(user.id, e.target.value)}
                      disabled={user.username === 'nexus_admin'}
                    >
                      <MenuItem value="ADMIN">ADMIN</MenuItem>
                      <MenuItem value="USER">USER</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {user.groups && user.groups.length > 0 ? (
                      user.groups.map((group, idx) => (
                        <Chip
                          key={idx}
                          label={group}
                          size="small"
                          variant="outlined"
                        />
                      ))
                    ) : (
                      <Typography variant="caption" className="dark:text-gray-500">
                        No groups
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => handleDeactivate(user.id, user.username)}
                    disabled={user.username === 'nexus_admin'}
                    title="Deactivate user"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Full Name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                label="Role"
              >
                <MenuItem value="USER">USER</MenuItem>
                <MenuItem value="ADMIN">ADMIN</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            disabled={!formData.username || !formData.email || !formData.password}
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UsersManagement;

