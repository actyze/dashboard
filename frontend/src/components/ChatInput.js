import React, { useState } from 'react';
import { Box } from '@mui/material';
import { Input, Button } from './ui';

const ChatInput = ({ onSubmit }) => {
  const [chatInput, setChatInput] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      const res = await fetch('/api/query', {
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
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <Input
          placeholder="Type a message..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="primary">Submit</Button>
      </form>
    </Box>
  );
};

export default ChatInput;
