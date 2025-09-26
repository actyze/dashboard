#!/usr/bin/env python3
"""
Download sentence transformer model locally to avoid SSL issues in containers.
This script downloads the model using requests library with custom SSL settings.
"""

import os
import requests
import json
from pathlib import Path

def download_file(url, local_path):
    """Download a file with custom SSL settings."""
    try:
        # Use requests with custom SSL settings
        response = requests.get(url, stream=True, timeout=30, verify=True)
        response.raise_for_status()
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Downloaded: {local_path}")
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

def main():
    """Download all required model files."""
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    base_url = f"https://huggingface.co/{model_name}/resolve/main"
    model_dir = Path("./model_cache")
    
    # List of files typically needed for sentence transformers
    files_to_download = [
        "config.json",
        "modules.json", 
        "pytorch_model.bin",
        "tokenizer.json",
        "tokenizer_config.json",
        "vocab.txt",
        "1_Pooling/config.json"
    ]
    
    success_count = 0
    for filename in files_to_download:
        url = f"{base_url}/{filename}"
        local_path = model_dir / filename
        if download_file(url, local_path):
            success_count += 1
    
    print(f"Downloaded {success_count}/{len(files_to_download)} files")
    
    if success_count > 0:
        print(f"Model files saved to: {model_dir}")
        return True
    else:
        print("Failed to download any model files")
        return False

if __name__ == "__main__":
    main()
