#!/usr/bin/env python3
"""Generate GraphQL schema file for documentation and client code generation."""

import os
import sys
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from app.graphql.schema import schema

def generate_schema_file():
    """Generate schema.graphql file."""
    schema_content = schema.as_str()
    
    # Write to schema.graphql file
    with open("schema.graphql", "w") as f:
        f.write(schema_content)
    
    print("✅ Generated schema.graphql")
    print(f"📄 Schema contains {len(schema_content.splitlines())} lines")
    print("🚀 Use this file for:")
    print("   - Client code generation (Apollo, Relay, etc.)")
    print("   - Schema documentation")
    print("   - API contract validation")

if __name__ == "__main__":
    generate_schema_file()
