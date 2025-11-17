import React from 'react';
import { Card, TextArea, Button } from './ui';

const SqlQuery = ({ sqlQuery, setSqlQuery, backendResponse, onExecute }) => (
  <Card className="h-full">
    <div className="space-y-4">
      <TextArea
        value={sqlQuery}
        onChange={(e) => setSqlQuery(e.target.value)}
        rows={8}
        placeholder="Enter your SQL query here..."
        className="font-mono text-sm"
      />
      <Button onClick={onExecute} variant="primary">
        Execute Query
      </Button>
    </div>
  </Card>
);

export default SqlQuery;
