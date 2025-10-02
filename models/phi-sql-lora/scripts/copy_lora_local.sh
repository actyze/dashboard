#!/bin/bash
# Simple script to copy LoRA adapters for local K8s testing

echo "📦 Copying LoRA adapters for K8s testing..."

# Create target directory
mkdir -p /models/phi4-trino477-lora

# Copy LoRA adapters from local training
cp -r /source/adapters/phi4-trino477-lora/* /models/phi4-trino477-lora/

echo "✅ LoRA adapters copied successfully"
echo "📊 Files copied:"
ls -la /models/phi4-trino477-lora/

echo "🎯 Ready for runtime merge server"
