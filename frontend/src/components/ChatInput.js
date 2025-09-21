import React, { useState } from 'react';
import { TextField, Button, Box } from '@mui/material';

const ChatInput = ({ onSubmit }) => {
  const [chatInput, setChatInput] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      const res = await fetch('http://localhost:8080/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          input: chatInput,
          type: 'auto',
          includeChart: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        await onSubmit(data.generatedSQL || data.sql || chatInput);
      } else {
        await onSubmit('Error: Backend did not respond successfully.');
      }
    } catch {
      await onSubmit('Error: Could not reach backend.');
    }
    setChatInput('');
  };

  return (
    <Box sx={{ mt: 2 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TextField
          fullWidth
          placeholder="Type a message..."
          variant="outlined"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          sx={{ 
            backgroundColor: '#ffffff',
            '& .MuiOutlinedInput-root': {
              borderRadius: 2
            }
          }}
        />
        <Button type="submit" variant="contained">Submit</Button>
      </form>
    </Box>
  );
};

export default ChatInput;
