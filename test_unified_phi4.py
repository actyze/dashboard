#!/usr/bin/env python3
"""
Test script for the unified Phi-4-mini server
Tests all 3 deployment modes: MPS, T4, API Key
"""

import os
import sys
import subprocess
import time
import requests

def test_mps_mode():
    """Test MPS mode locally"""
    print("🍎 Testing MPS Mode (Apple Silicon)")
    
    # Set environment for MPS
    env = os.environ.copy()
    env.update({
        "DEPLOYMENT_MODE": "mps",
        "MODEL_NAME": "microsoft/Phi-4-mini-instruct",
        "LORA_ADAPTER_PATH": "models/phi-sql-lora/adapters/phi4-trino477-lora",
        "PORT": "8001"
    })
    
    print("Starting MPS server...")
    process = subprocess.Popen([
        sys.executable, "models/phi-sql-lora/scripts/cpu_int8_server.py"
    ], env=env)
    
    # Wait for startup
    time.sleep(30)
    
    try:
        # Test health endpoint
        response = requests.get("http://localhost:8001/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ MPS Health: {data}")
            
            # Test inference
            test_request = {
                "prompt": "Show me all customers from New York",
                "max_tokens": 100
            }
            
            response = requests.post("http://localhost:8001/predict", json=test_request, timeout=30)
            if response.status_code == 200:
                result = response.json()
                print(f"✅ MPS Inference: {result.get('inference_time')} - {result.get('device')}")
                return True
            else:
                print(f"❌ MPS Inference failed: {response.status_code}")
                return False
        else:
            print(f"❌ MPS Health failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ MPS Test failed: {e}")
        return False
    finally:
        process.terminate()
        process.wait()

def test_api_key_mode():
    """Test API Key mode"""
    print("🔑 Testing API Key Mode")
    
    # Set environment for API key
    env = os.environ.copy()
    env.update({
        "DEPLOYMENT_MODE": "api_key",
        "EXTERNAL_API_KEY": "test-key",
        "EXTERNAL_API_ENDPOINT": "https://api.perplexity.ai",
        "PORT": "8002"
    })
    
    print("Starting API Key server...")
    process = subprocess.Popen([
        sys.executable, "models/phi-sql-lora/scripts/cpu_int8_server.py"
    ], env=env)
    
    # Wait for startup
    time.sleep(5)
    
    try:
        # Test health endpoint
        response = requests.get("http://localhost:8002/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API Key Health: {data}")
            return True
        else:
            print(f"❌ API Key Health failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ API Key Test failed: {e}")
        return False
    finally:
        process.terminate()
        process.wait()

def main():
    print("🧪 Testing Unified Phi-4-mini Server")
    print("=" * 50)
    
    results = []
    
    # Test MPS mode
    mps_result = test_mps_mode()
    results.append(("MPS", mps_result))
    
    print("\n" + "-" * 30 + "\n")
    
    # Test API Key mode
    api_result = test_api_key_mode()
    results.append(("API Key", api_result))
    
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print("=" * 50)
    
    for mode, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{mode} Mode: {status}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n🎉 All tests passed! Your unified server is ready.")
        print("\n💡 Next steps:")
        print("1. Update Helm values to enable phiSqlLora")
        print("2. Set deploymentMode to 'mps' for local development")
        print("3. Deploy with: helm upgrade dashboard helm/dashboard --values helm/dashboard/values-dev.yaml")
    else:
        print("\n⚠️ Some tests failed. Check the logs above.")

if __name__ == "__main__":
    main()
