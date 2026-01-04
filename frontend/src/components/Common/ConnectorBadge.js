import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * ConnectorBadge Component
 * Displays a colored badge with icon for Trino connector types
 * 
 * @param {string} connector_type - The Trino connector name (e.g., "postgresql", "mysql", "mongodb")
 * @param {string} size - Size of badge: "sm" | "md" | "lg"
 * @param {boolean} showIcon - Whether to show the connector icon
 */
const ConnectorBadge = ({ connector_type, size = 'sm', showIcon = true }) => {
  const { isDark } = useTheme();

  // Connector type configuration
  const connectorConfig = {
    postgresql: {
      label: 'PostgreSQL',
      bgLight: 'bg-blue-100',
      bgDark: 'bg-blue-900',
      textLight: 'text-blue-800',
      textDark: 'text-blue-200',
      icon: '🐘', // Elephant (PostgreSQL mascot)
    },
    mysql: {
      label: 'MySQL',
      bgLight: 'bg-orange-100',
      bgDark: 'bg-orange-900',
      textLight: 'text-orange-800',
      textDark: 'text-orange-200',
      icon: '🐬', // Dolphin (MySQL mascot)
    },
    mongodb: {
      label: 'MongoDB',
      bgLight: 'bg-green-100',
      bgDark: 'bg-green-900',
      textLight: 'text-green-800',
      textDark: 'text-green-200',
      icon: '🍃', // Leaf (MongoDB logo)
    },
    iceberg: {
      label: 'Iceberg',
      bgLight: 'bg-cyan-100',
      bgDark: 'bg-cyan-900',
      textLight: 'text-cyan-800',
      textDark: 'text-cyan-200',
      icon: '🧊', // Ice cube
    },
    hive: {
      label: 'Hive',
      bgLight: 'bg-yellow-100',
      bgDark: 'bg-yellow-900',
      textLight: 'text-yellow-800',
      textDark: 'text-yellow-200',
      icon: '🐝', // Bee (Hive logo)
    },
    delta: {
      label: 'Delta Lake',
      bgLight: 'bg-purple-100',
      bgDark: 'bg-purple-900',
      textLight: 'text-purple-800',
      textDark: 'text-purple-200',
      icon: '🔺', // Delta symbol
    },
    tpch: {
      label: 'TPC-H',
      bgLight: 'bg-gray-100',
      bgDark: 'bg-gray-700',
      textLight: 'text-gray-800',
      textDark: 'text-gray-200',
      icon: '📊', // Chart (benchmark data)
    },
    redshift: {
      label: 'Redshift',
      bgLight: 'bg-red-100',
      bgDark: 'bg-red-900',
      textLight: 'text-red-800',
      textDark: 'text-red-200',
      icon: '🔴', // Red circle (AWS Redshift)
    },
    bigquery: {
      label: 'BigQuery',
      bgLight: 'bg-indigo-100',
      bgDark: 'bg-indigo-900',
      textLight: 'text-indigo-800',
      textDark: 'text-indigo-200',
      icon: '☁️', // Cloud (GCP BigQuery)
    },
    snowflake: {
      label: 'Snowflake',
      bgLight: 'bg-sky-100',
      bgDark: 'bg-sky-900',
      textLight: 'text-sky-800',
      textDark: 'text-sky-200',
      icon: '❄️', // Snowflake
    },
    elasticsearch: {
      label: 'Elasticsearch',
      bgLight: 'bg-teal-100',
      bgDark: 'bg-teal-900',
      textLight: 'text-teal-800',
      textDark: 'text-teal-200',
      icon: '🔍', // Magnifying glass (search)
    },
    cassandra: {
      label: 'Cassandra',
      bgLight: 'bg-pink-100',
      bgDark: 'bg-pink-900',
      textLight: 'text-pink-800',
      textDark: 'text-pink-200',
      icon: '💎', // Diamond (distributed database)
    },
    kafka: {
      label: 'Kafka',
      bgLight: 'bg-gray-100',
      bgDark: 'bg-gray-800',
      textLight: 'text-gray-900',
      textDark: 'text-gray-100',
      icon: '📨', // Incoming envelope (streaming)
    },
    system: {
      label: 'System',
      bgLight: 'bg-gray-100',
      bgDark: 'bg-gray-700',
      textLight: 'text-gray-600',
      textDark: 'text-gray-400',
      icon: '⚙️', // Gear (system tables)
    },
    memory: {
      label: 'Memory',
      bgLight: 'bg-gray-100',
      bgDark: 'bg-gray-700',
      textLight: 'text-gray-600',
      textDark: 'text-gray-400',
      icon: '💾', // Floppy disk (memory storage)
    },
    unknown: {
      label: 'Unknown',
      bgLight: 'bg-gray-100',
      bgDark: 'bg-gray-700',
      textLight: 'text-gray-600',
      textDark: 'text-gray-400',
      icon: '❓', // Question mark
    },
  };

  // Size configuration
  const sizeClasses = {
    sm: {
      badge: 'px-1.5 py-0.5 text-xs',
      icon: 'text-xs',
    },
    md: {
      badge: 'px-2 py-1 text-sm',
      icon: 'text-sm',
    },
    lg: {
      badge: 'px-3 py-1.5 text-base',
      icon: 'text-base',
    },
  };

  // Get connector configuration (default to unknown if not found)
  const config = connectorConfig[connector_type?.toLowerCase()] || connectorConfig.unknown;
  const sizeConfig = sizeClasses[size] || sizeClasses.sm;

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${sizeConfig.badge}
        ${isDark ? `${config.bgDark} ${config.textDark}` : `${config.bgLight} ${config.textLight}`}
      `}
      title={`Trino Connector: ${config.label}`}
    >
      {showIcon && <span className={sizeConfig.icon}>{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
};

export default ConnectorBadge;

