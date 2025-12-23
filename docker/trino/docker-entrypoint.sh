#!/bin/bash
set -e

echo "===== Trino Catalog Generation ====="

# Create catalog directory if it doesn't exist
mkdir -p /etc/trino/catalog

# Function to substitute environment variables in a file
# Replaces ${VAR_NAME} with the value of the environment variable
substitute_env_vars() {
    local input_file="$1"
    local output_file="$2"
    
    # Start with the input file
    cp "$input_file" "$output_file.tmp"
    
    # Get all environment variable names
    env_vars=$(env | cut -d= -f1)
    
    # Replace each ${VAR} with its value
    for var in $env_vars; do
        value="${!var}"
        # Escape special characters in value for sed
        escaped_value=$(printf '%s\n' "$value" | sed -e 's/[\/&]/\\&/g')
        sed -i "s/\${${var}}/${escaped_value}/g" "$output_file.tmp"
    done
    
    # Move temp file to final destination
    mv "$output_file.tmp" "$output_file"
}

# Process all .tpl files in catalog-templates/
template_count=0
for template in /etc/trino/catalog-templates/*.tpl; do
    # Check if file exists (handles case where no .tpl files exist)
    if [ -f "$template" ]; then
        # Extract catalog name (filename without .properties.tpl extension)
        filename=$(basename "$template")
        catalog_name="${filename%.properties.tpl}"
        
        # Substitute environment variables
        substitute_env_vars "$template" "/etc/trino/catalog/${catalog_name}.properties"
        
        echo "  ✓ Generated catalog: ${catalog_name}"
        template_count=$((template_count + 1))
    fi
done

if [ $template_count -eq 0 ]; then
    echo "  ⚠ Warning: No catalog templates found in /etc/trino/catalog-templates/"
else
    echo "  Generated $template_count catalog(s) successfully"
fi

echo ""
echo "===== Starting Trino ====="
echo ""

# Execute the original Trino entrypoint
exec /usr/lib/trino/bin/run-trino
