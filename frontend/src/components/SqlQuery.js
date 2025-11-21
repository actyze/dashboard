import React from 'react';
import { Card, TextArea, Button } from './ui';

const SqlQuery = ({ sqlQuery, setSqlQuery, backendResponse, onExecute }) => (
  <div className="h-full w-full">
    <TextArea
      value={sqlQuery}
      onChange={(e) => setSqlQuery(e.target.value)}
      rows={8}
      placeholder="Enter your SQL query here..."
      className="font-mono text-sm w-full border-gray-200 dark:border-gray-700"
    />
  </div>
);

export default SqlQuery;
