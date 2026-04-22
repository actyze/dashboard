# SPDX-License-Identifier: AGPL-3.0-only
"""Worker configuration — reads credentials from environment variables."""

import os


def get_trino_config():
    return {
        "host": os.environ.get("TRINO_HOST", "dashboard-trino"),
        "port": int(os.environ.get("TRINO_PORT", "8080")),
        "user": os.environ.get("TRINO_USER", "admin"),
        "password": os.environ.get("TRINO_PASSWORD", ""),
        "catalog": os.environ.get("TRINO_CATALOG", "postgres"),
        "schema": os.environ.get("TRINO_SCHEMA", "public"),
        "ssl": os.environ.get("TRINO_SSL", "false").lower() == "true",
    }


def get_postgres_config():
    return {
        "host": os.environ.get("POSTGRES_HOST", "dashboard-postgres"),
        "port": int(os.environ.get("POSTGRES_PORT", "5432")),
        "database": os.environ.get("POSTGRES_DATABASE", "dashboard"),
        "user": os.environ.get("POSTGRES_USER", "nexus_service"),
        "password": os.environ.get("POSTGRES_PASSWORD", ""),
    }


WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
