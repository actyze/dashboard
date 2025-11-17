import React, { useState } from 'react';
import { Input, Text, Button, Alert, Table, TextArea, Card } from './ui';

const UIDemo = () => {
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [showAlert, setShowAlert] = useState(true);

  // Sample data for table
  const tableData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
    { id: 3, name: 'Mike Johnson', email: 'mike@example.com', role: 'Editor' },
  ];

  const tableColumns = [
    { key: 'name', title: 'Name' },
    { key: 'email', title: 'Email' },
    { key: 'role', title: 'Role', render: (value) => (
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        value === 'Admin' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
        value === 'Editor' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      }`}>
        {value}
      </span>
    )},
  ];

  return (
    <div className="space-y-8 p-6">
      <Text variant="h2" className="mb-8">UI Components Demo</Text>
      
      {/* Alerts */}
      <Card>
        <Card.Header>
          <Card.Title>Alerts</Card.Title>
        </Card.Header>
        <div className="space-y-4">
          <Alert variant="success" dismissible>
            <strong>Success!</strong> Your operation was completed successfully.
          </Alert>
          <Alert variant="error" title="Error occurred">
            Something went wrong while processing your request.
          </Alert>
          <Alert variant="warning">
            <strong>Warning:</strong> This action cannot be undone.
          </Alert>
          <Alert variant="info">
            <strong>Info:</strong> This is some helpful information.
          </Alert>
        </div>
      </Card>

      {/* Inputs */}
      <Card>
        <Card.Header>
          <Card.Title>Input Fields</Card.Title>
        </Card.Header>
        <div className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            required
          />
          <Input
            label="Search"
            placeholder="Search..."
            variant="filled"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter password"
            variant="ghost"
            error
            errorMessage="Password is required"
          />
        </div>
      </Card>

      {/* Buttons */}
      <Card>
        <Card.Header>
          <Card.Title>Buttons</Card.Title>
        </Card.Header>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="success">Success</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="xs">Extra Small</Button>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button loading>Loading...</Button>
            <Button disabled>Disabled</Button>
            <Button fullWidth>Full Width</Button>
          </div>
        </div>
      </Card>

      {/* Text Components */}
      <Card>
        <Card.Header>
          <Card.Title>Typography</Card.Title>
        </Card.Header>
        <div className="space-y-2">
          <Text variant="h1">Heading 1</Text>
          <Text variant="h2">Heading 2</Text>
          <Text variant="h3">Heading 3</Text>
          <Text variant="subtitle1">Subtitle 1</Text>
          <Text variant="body">Body text - This is regular paragraph text with normal styling.</Text>
          <Text variant="caption" color="secondary">Caption text in secondary color</Text>
          <Text variant="overline">Overline text</Text>
        </div>
      </Card>

      {/* TextArea */}
      <Card>
        <Card.Header>
          <Card.Title>Text Area</Card.Title>
        </Card.Header>
        <div className="space-y-4">
          <TextArea
            label="Description"
            placeholder="Enter your description..."
            value={textareaValue}
            onChange={(e) => setTextareaValue(e.target.value)}
            rows={4}
            maxLength={200}
            showCharCount
          />
          <TextArea
            placeholder="Filled variant..."
            variant="filled"
            rows={3}
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Card.Header>
          <Card.Title>Table</Card.Title>
        </Card.Header>
        <Table
          data={tableData}
          columns={tableColumns}
          striped
          hoverable
        />
      </Card>

      {/* Cards Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card variant="default" hoverable>
          <Card.Header>
            <Card.Title>Default Card</Card.Title>
            <Card.Description>This is a default card with hover effect</Card.Description>
          </Card.Header>
          <Card.Body>
            <Text>Some content goes here...</Text>
          </Card.Body>
          <Card.Footer>
            <Card.Actions>
              <Button size="sm" variant="outline">Cancel</Button>
              <Button size="sm">Save</Button>
            </Card.Actions>
          </Card.Footer>
        </Card>

        <Card variant="primary" bordered>
          <Card.Header>
            <Card.Title>Primary Card</Card.Title>
          </Card.Header>
          <Card.Body>
            <Text>This is a primary themed card with border.</Text>
          </Card.Body>
        </Card>

        <Card variant="gradient" shadow="lg">
          <Card.Header>
            <Card.Title>Gradient Card</Card.Title>
          </Card.Header>
          <Card.Body>
            <Text>Beautiful gradient background with large shadow.</Text>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
};

export default UIDemo;