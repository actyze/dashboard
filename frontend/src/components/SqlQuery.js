import React from 'react';
import { Paper, TextField, Button, Box, Typography } from '@mui/material';

const SqlQuery = ({ sqlQuery, setSqlQuery, backendResponse, onExecute }) => (
  <Paper sx={{ p: 2, height: 'calc(100% - 40px)', backgroundColor: '#f8f9fa' }}>
    <TextField
      multiline
      fullWidth
      rows={5}
      variant="outlined"
      value={sqlQuery}
      onChange={(e) => setSqlQuery(e.target.value)}
      sx={{ 
        fontFamily: 'monospace',
        backgroundColor: '#f8f9fa',
        mb: 2,
        '& .MuiOutlinedInput-root': {
          backgroundColor: '#f8f9fa'
        }
      }}
    />
    <Button variant="contained" onClick={onExecute}>Execute</Button>
  </Paper>
);

export default SqlQuery;
