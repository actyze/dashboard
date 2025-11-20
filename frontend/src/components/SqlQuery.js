import React from 'react';
<<<<<<< Updated upstream
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
=======
import { TextArea } from './ui';

const SqlQuery = ({ sqlQuery, setSqlQuery, backendResponse }) => (
  <div className="h-full w-full">
    <TextArea
      value={sqlQuery}
      onChange={(e) => setSqlQuery(e.target.value)}
      rows={8}
      placeholder="Enter your SQL query here..."
      className="font-mono text-sm w-full border-gray-200 dark:border-gray-700"
    />
  </div>
>>>>>>> Stashed changes
);

export default SqlQuery;
