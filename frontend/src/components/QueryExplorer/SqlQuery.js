import React from 'react';
import { SqlEditor } from '../Common';

const SqlQuery = ({ sqlQuery, setSqlQuery }) => {
  return (
    <div className="h-full w-full">
      <SqlEditor
        value={sqlQuery}
        onChange={setSqlQuery}
        height="180px"
        placeholder="Enter your SQL query here..."
      />
    </div>
  );
};

export default SqlQuery;
