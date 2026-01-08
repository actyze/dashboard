#!/usr/bin/env python3
"""
Essential test suite for schema service - consolidated from multiple test files.
Tests: spaCy NER, entity detection, performance, and API functionality.
"""

import time
import requests
import statistics
from typing import List, Dict, Any

def test_schema_service_health(base_url: str = "http://localhost:8001"):
    """Test basic health and connectivity."""
    print("🏥 Testing Schema Service Health")
    print("-" * 40)
    
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Service healthy")
            print(f"   • Total schemas: {data.get('total_schemas', 'unknown')}")
            print(f"   • Index size: {data.get('index_size', 'unknown')}")
            print(f"   • Last updated: {data.get('last_updated', 'unknown')}")
            return True
        else:
            print(f"❌ Health check failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect: {e}")
        return False

def test_enhanced_features(base_url: str = "http://localhost:8001"):
    """Test enhanced spaCy features and entity detection."""
    print("\n🧠 Testing Enhanced spaCy Features")
    print("-" * 40)
    
    test_queries = [
        {"query": "Show me Apple iPhone sales in Chicago for John Smith", "expected_entities": ["ORG", "PRODUCT", "GPE", "PERSON"]},
        {"query": "Nike shoes inventory in California", "expected_entities": ["ORG", "PRODUCT", "GPE"]},
        {"query": "Orders over $1000 in January 2024", "expected_entities": ["MONEY", "DATE"]},
    ]
    
    enhanced_working = False
    
    for i, test_case in enumerate(test_queries, 1):
        query = test_case["query"]
        expected = test_case["expected_entities"]
        
        print(f"\n{i}. Testing: '{query[:50]}...'")
        
        try:
            response = requests.post(
                f"{base_url}/recommend",
                json={
                    "natural_language_query": query,
                    "top_k": 3,
                    "confidence_threshold": 0.3
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for enhanced fields
                entities_detected = data.get('entities_detected')
                entity_count = data.get('entity_count')
                enhanced_terms_count = data.get('enhanced_terms_count')
                
                if entities_detected is not None and entity_count is not None:
                    enhanced_working = True
                    detected_types = list(entities_detected.keys()) if entities_detected else []
                    print(f"   ✅ Enhanced API working: {entity_count} entities {detected_types}")
                    print(f"   📊 Enhanced terms: {enhanced_terms_count}")
                    
                    # Check entity boosting
                    boosted_recs = [rec for rec in data.get('recommendations', []) if 'entity_boost' in rec]
                    if boosted_recs:
                        print(f"   🚀 Entity boosting: {len(boosted_recs)} recommendations boosted")
                else:
                    print(f"   ⚠️  Enhanced fields missing (entities_detected: {entities_detected})")
                    
            else:
                print(f"   ❌ HTTP {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    return enhanced_working

def test_performance_baseline(base_url: str = "http://localhost:8001"):
    """Test performance baseline with various query complexities."""
    print("\n⏱️  Testing Performance Baseline")
    print("-" * 40)
    
    test_queries = [
        {"query": "Show customers", "category": "Simple"},
        {"query": "iPhone sales in Chicago", "category": "Medium"},
        {"query": "Apple iPhone sales to enterprise customers in New York with orders over $1000", "category": "Complex"},
    ]
    
    results = []
    
    for test_case in test_queries:
        query = test_case["query"]
        category = test_case["category"]
        
        start_time = time.perf_counter()
        
        try:
            response = requests.post(
                f"{base_url}/recommend",
                json={
                    "natural_language_query": query,
                    "top_k": 5,
                    "confidence_threshold": 0.3
                },
                timeout=15
            )
            
            end_time = time.perf_counter()
            response_time = (end_time - start_time) * 1000
            
            if response.status_code == 200:
                data = response.json()
                rec_count = len(data.get('recommendations', []))
                results.append(response_time)
                print(f"   {category:8}: {response_time:.1f}ms, {rec_count} recommendations")
            else:
                print(f"   {category:8}: ❌ HTTP {response.status_code}")
                
        except Exception as e:
            print(f"   {category:8}: ❌ {e}")
    
    if results:
        avg_time = statistics.mean(results)
        print(f"\n📊 Performance Summary:")
        print(f"   Average response time: {avg_time:.1f}ms")
        
        if avg_time < 200:
            print("   🚀 Excellent performance")
        elif avg_time < 500:
            print("   ✅ Good performance")
        elif avg_time < 1000:
            print("   ⚠️  Acceptable performance")
        else:
            print("   ❌ Needs optimization")
    
    return results

def main():
    """Run essential test suite."""
    print("🧪 Schema Service - Essential Test Suite")
    print("=" * 60)
    
    base_url = "http://localhost:8001"
    
    # Test 1: Health check
    if not test_schema_service_health(base_url):
        print("\n❌ Service not available - cannot continue tests")
        return
    
    # Test 2: Enhanced features
    enhanced_working = test_enhanced_features(base_url)
    
    # Test 3: Performance baseline
    performance_results = test_performance_baseline(base_url)
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 Test Summary:")
    print(f"   • Service health: ✅ Working")
    print(f"   • Enhanced features: {'✅ Working' if enhanced_working else '❌ Issues detected'}")
    print(f"   • Performance: {'✅ Tested' if performance_results else '❌ Failed'}")
    
    if not enhanced_working:
        print("\n🔍 Debug Recommendations:")
        print("   • Check if enhanced schema_service.py is deployed")
        print("   • Verify spaCy model loading in container logs")
        print("   • Ensure enhanced recommend() method is being called")

if __name__ == "__main__":
    main()
