"""
Test script for FAISS Schema Service

This script demonstrates how to use the schema service and provides
example queries for testing the recommendation system.
"""

import requests
import json
import time
from typing import Dict, Any

class SchemaServiceClient:
    """Client for interacting with the FAISS Schema Service"""
    
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
    
    def health_check(self) -> Dict[str, Any]:
        """Check service health"""
        response = requests.get(f"{self.base_url}/health")
        return response.json()
    
    def get_recommendations(self, query: str, top_k: int = 5, 
                          confidence_threshold: float = 0.3) -> Dict[str, Any]:
        """Get schema recommendations for natural language query"""
        payload = {
            "natural_language_query": query,
            "top_k": top_k,
            "confidence_threshold": confidence_threshold
        }
        response = requests.post(f"{self.base_url}/recommend", json=payload)
        return response.json()
    
    def refresh_schemas(self) -> Dict[str, Any]:
        """Manually trigger schema refresh"""
        response = requests.post(f"{self.base_url}/refresh")
        return response.json()
    
    def list_schemas(self) -> Dict[str, Any]:
        """List all loaded schemas"""
        response = requests.get(f"{self.base_url}/schemas")
        return response.json()

def test_schema_service():
    """Test the schema service with various queries"""
    client = SchemaServiceClient()
    
    print("🔍 Testing FAISS Schema Service")
    print("=" * 50)
    
    # Health check
    try:
        health = client.health_check()
        print(f"✅ Service Status: {health['status']}")
        print(f"📊 Total Schemas: {health['total_schemas']}")
        print(f"🕒 Last Updated: {health['last_updated']}")
        print()
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return
    
    # Test queries
    test_queries = [
        "Show me customer sales data",
        "Find user login information",
        "Get product inventory levels",
        "Display employee payroll records",
        "Show order transaction history",
        "Find customer demographics and preferences",
        "Get financial revenue reports",
        "Show website analytics data"
    ]
    
    print("🧪 Testing Natural Language Queries")
    print("-" * 40)
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n{i}. Query: '{query}'")
        try:
            start_time = time.time()
            result = client.get_recommendations(query, top_k=3, confidence_threshold=0.2)
            end_time = time.time()
            
            print(f"   ⏱️  Response Time: {(end_time - start_time)*1000:.1f}ms")
            print(f"   🎯 Recommendations: {len(result['recommendations'])}")
            print(f"   🔍 Embedding Time: {result.get('query_embedding_time', 0)*1000:.1f}ms")
            print(f"   🔎 Search Time: {result.get('search_time', 0)*1000:.1f}ms")
            
            for j, rec in enumerate(result['recommendations'][:2], 1):  # Show top 2
                print(f"   {j}. {rec['full_name']} (confidence: {rec['confidence']:.3f})")
                print(f"      📋 Columns: {', '.join(rec['columns'][:5])}{'...' if len(rec['columns']) > 5 else ''}")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("✅ Schema Service Testing Complete")

if __name__ == "__main__":
    test_schema_service()
