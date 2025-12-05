import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  IconButton,
  Typography
} from '@mui/material';
import { Button, Alert } from '../ui';
import { useTheme } from '../../contexts/ThemeContext';

const SqlTileModal = ({ open, onClose, onSave, initialData = null }) => {
  const { isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [chartType, setChartType] = useState('table');
  const [database, setDatabase] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setSqlQuery(initialData.sqlQuery || '');
      setChartType(initialData.chartType || 'table');
      setDatabase(initialData.database || '');
    } else {
      setTitle('');
      setSqlQuery('');
      setChartType('table');
      setDatabase('');
    }
    setError(null);
  }, [initialData, open]);

  const handleSave = () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!sqlQuery.trim()) {
      setError('SQL query is required');
      return;
    }

    onSave({
      id: initialData?.id || Date.now().toString(),
      title: title.trim(),
      sqlQuery: sqlQuery.trim(),
      chartType,
      database,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    onClose();
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: isDark ? '#1f2937' : '#fff',
          backgroundImage: 'none'
        }
      }}
    >
      <DialogTitle sx={{ 
        color: isDark ? '#fff' : 'inherit',
        borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)'
      }}>
        <div className="flex items-center justify-between">
          <Typography variant="h6" component="div">
            {initialData ? 'Edit Tile' : 'Create New Tile'}
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
      </DialogTitle>
      
      <DialogContent sx={{ 
        pt: 3,
        backgroundColor: isDark ? '#1f2937' : '#fff'
      }}>
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="space-y-5">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Tile Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Monthly Sales Report"
              className={`
                w-full px-4 py-2.5 rounded-lg text-sm
                transition-all duration-200
                ${isDark 
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }
                border outline-none
              `}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Database
              </label>
              <select
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                className={`
                  w-full px-4 py-2.5 rounded-lg text-sm
                  transition-all duration-200
                  ${isDark 
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }
                  border outline-none cursor-pointer
                `}
              >
                <option value="">No Database</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="trino">Trino</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Visualization
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className={`
                  w-full px-4 py-2.5 rounded-lg text-sm
                  transition-all duration-200
                  ${isDark 
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }
                  border outline-none cursor-pointer
                `}
              >
                <option value="table">Table</option>
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="area">Area Chart</option>
                <option value="scatter">Scatter Plot</option>
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              SQL Query
            </label>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              rows={10}
              placeholder="SELECT column1, column2 FROM table_name WHERE condition"
              className={`
                w-full px-4 py-2.5 rounded-lg text-sm font-mono
                transition-all duration-200
                ${isDark 
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }
                border outline-none resize-none
              `}
            />
          </div>
        </div>
      </DialogContent>

      <DialogActions sx={{ 
        p: 2,
        backgroundColor: isDark ? '#1f2937' : '#fff',
        borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)'
      }}>
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          {initialData ? 'Update Tile' : 'Create Tile'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SqlTileModal;

