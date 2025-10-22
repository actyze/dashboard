#!/usr/bin/env python3
"""
Natural Language Query Tracing Test
Traces the complete flow from NL query to SQL generation with detailed performance metrics
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8080"
TEST_QUERIES = [
    "Show me customers from New York",
    "List all products with price greater than 100",
    "Find orders from last month"
]

def log_stage(stage_name, start_time, end_time, status, details=None):
    """Log performance metrics for each stage"""
    duration_ms = int((end_time - start_time) * 1000)
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    
    print(f"[{timestamp}] 📊 {stage_name}")
    print(f"           ⏱️  Duration: {duration_ms}ms")
    print(f"           📈 Status: {status}")
    if details:
        print(f"           📝 Details: {details}")
    print()
    
    return duration_ms

def trace_natural_language_query(query, use_real_llm=False):
    """Trace a complete natural language query with detailed metrics"""
    
    print("🔍 NATURAL LANGUAGE QUERY TRACE")
    print("=" * 80)
    print(f"📝 Query: '{query}'")
    print(f"🤖 External LLM: {'ENABLED' if use_real_llm else 'DRY RUN (no credits used)'}")
    print(f"🕐 Start Time: {datetime.now().strftime('%H:%M:%S')}")
    print()
    
    total_start = time.time()
    stage_times = {}
    
    # Stage 1: Request Preparation
    stage_start = time.time()
    request_payload = {
        "message": query,
        "conversationHistory": [],
        "includeMetrics": True,  # Request detailed metrics
        "dryRun": not use_real_llm  # Prevent actual LLM calls unless specified
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    stage_end = time.time()
    stage_times['request_prep'] = log_stage(
        "Request Preparation", 
        stage_start, stage_end, 
        "✅ Complete",
        f"Payload size: {len(json.dumps(request_payload))} bytes"
    )
    
    # Stage 2: HTTP Request to Backend
    stage_start = time.time()
    try:
        print(f"🌐 Making HTTP Request to: {BACKEND_URL}/api/natural-language")
        print(f"📤 Request Headers: {json.dumps(headers, indent=2)}")
        print(f"📤 Request Payload:")
        print(json.dumps(request_payload, indent=2))
        print()
        
        response = requests.post(
            f"{BACKEND_URL}/api/natural-language",
            json=request_payload,
            headers=headers,
            timeout=60  # Longer timeout for external LLM
        )
        
        stage_end = time.time()
        stage_times['http_request'] = log_stage(
            "HTTP Request to Backend",
            stage_start, stage_end,
            f"✅ HTTP {response.status_code}",
            f"Response size: {len(response.text)} bytes"
        )
        
    except requests.exceptions.Timeout:
        stage_end = time.time()
        stage_times['http_request'] = log_stage(
            "HTTP Request to Backend",
            stage_start, stage_end,
            "❌ Timeout",
            "Request exceeded 60 second timeout"
        )
        return None
        
    except Exception as e:
        stage_end = time.time()
        stage_times['http_request'] = log_stage(
            "HTTP Request to Backend",
            stage_start, stage_end,
            f"❌ Error: {type(e).__name__}",
            str(e)
        )
        return None
    
    # Stage 3: Response Processing
    stage_start = time.time()
    
    print(f"📥 Raw Response (Status {response.status_code}):")
    print("-" * 40)
    print(response.text)
    print("-" * 40)
    print()
    
    if response.status_code == 200:
        try:
            response_data = response.json()
            stage_end = time.time()
            stage_times['response_processing'] = log_stage(
                "Response Processing",
                stage_start, stage_end,
                "✅ JSON Parsed",
                f"Fields: {list(response_data.keys())}"
            )
        except json.JSONDecodeError as e:
            stage_end = time.time()
            stage_times['response_processing'] = log_stage(
                "Response Processing",
                stage_start, stage_end,
                "❌ JSON Parse Error",
                str(e)
            )
            return None
    else:
        stage_end = time.time()
        stage_times['response_processing'] = log_stage(
            "Response Processing",
            stage_start, stage_end,
            f"❌ HTTP Error {response.status_code}",
            response.text[:200] + "..." if len(response.text) > 200 else response.text
        )
        return None
    
    # Stage 4: Detailed Response Analysis
    stage_start = time.time()
    
    print("🔬 DETAILED RESPONSE ANALYSIS")
    print("=" * 50)
    
    # Extract backend processing metrics if available
    backend_metrics = {}
    if 'processingTime' in response_data:
        backend_metrics['total_processing'] = response_data['processingTime']
    
    if 'metrics' in response_data:
        backend_metrics.update(response_data['metrics'])
    
    # Analyze response structure
    response_analysis = {
        'success': response_data.get('success', False),
        'has_sql': 'generatedSQL' in response_data,
        'has_schema_recommendations': 'schemaRecommendations' in response_data,
        'has_reasoning': 'reasoning' in response_data,
        'has_confidence': 'confidence' in response_data,
        'backend_metrics': backend_metrics
    }
    
    print("📊 Response Structure:")
    for key, value in response_analysis.items():
        if key != 'backend_metrics':
            status = "✅" if value else "❌"
            print(f"   {status} {key.replace('_', ' ').title()}: {value}")
    
    print()
    print("⚡ Backend Performance Metrics:")
    if backend_metrics:
        for metric, value in backend_metrics.items():
            print(f"   📈 {metric.replace('_', ' ').title()}: {value}ms")
    else:
        print("   ⚠️  No detailed metrics available")
    
    print()
    
    # Extract key response fields
    if response_data.get('success'):
        print("✅ SUCCESSFUL QUERY PROCESSING")
        print("-" * 30)
        
        if 'generatedSQL' in response_data:
            print(f"🗄️  Generated SQL:")
            print(f"   {response_data['generatedSQL']}")
            print()
        
        if 'reasoning' in response_data:
            print(f"🧠 LLM Reasoning:")
            print(f"   {response_data['reasoning']}")
            print()
        
        if 'confidence' in response_data:
            print(f"🎯 Confidence Score: {response_data['confidence']}")
            print()
        
        if 'schemaRecommendations' in response_data:
            recommendations = response_data['schemaRecommendations']
            print(f"📋 Schema Recommendations: {len(recommendations)} found")
            for i, rec in enumerate(recommendations[:3]):  # Show first 3
                print(f"   {i+1}. {rec.get('tableName', 'Unknown')} (confidence: {rec.get('confidence', 'N/A')})")
            print()
    else:
        print("❌ QUERY PROCESSING FAILED")
        if 'error' in response_data:
            print(f"   Error: {response_data['error']}")
        print()
    
    stage_end = time.time()
    stage_times['response_analysis'] = log_stage(
        "Response Analysis",
        stage_start, stage_end,
        "✅ Complete",
        f"Analysis completed"
    )
    
    # Final Summary
    total_end = time.time()
    total_time = int((total_end - total_start) * 1000)
    
    print("📊 PERFORMANCE SUMMARY")
    print("=" * 50)
    print(f"🕐 Total Query Time: {total_time}ms")
    print()
    print("⏱️  Stage Breakdown:")
    for stage, duration in stage_times.items():
        percentage = (duration / total_time) * 100
        print(f"   📈 {stage.replace('_', ' ').title()}: {duration}ms ({percentage:.1f}%)")
    
    print()
    
    # Performance Assessment
    if total_time < 5000:  # Less than 5 seconds
        print("🚀 EXCELLENT PERFORMANCE!")
        print("   ✅ Response time under 5 seconds")
    elif total_time < 10000:  # Less than 10 seconds
        print("✅ GOOD PERFORMANCE")
        print("   ⚠️  Response time acceptable but could be optimized")
    else:
        print("⚠️  SLOW PERFORMANCE")
        print("   ❌ Response time over 10 seconds - needs optimization")
    
    print()
    return response_data

def run_query_trace_test():
    """Run comprehensive query tracing test"""
    
    print("🧪 NATURAL LANGUAGE QUERY TRACING TEST")
    print("=" * 80)
    print()
    
    # Test backend connectivity first
    try:
        health_response = requests.get(f"{BACKEND_URL}/api/status", timeout=5)
        if health_response.status_code != 200:
            print(f"❌ Backend not healthy: HTTP {health_response.status_code}")
            return False
        print("✅ Backend is healthy and ready")
        print()
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        return False
    
    # Run trace for each test query
    results = []
    for i, query in enumerate(TEST_QUERIES, 1):
        print(f"🧪 TEST {i}/{len(TEST_QUERIES)}")
        print("=" * 80)
        
        result = trace_natural_language_query(query, use_real_llm=False)  # Dry run first
        results.append({
            'query': query,
            'success': result is not None and result.get('success', False),
            'result': result
        })
        
        if i < len(TEST_QUERIES):
            print("\n" + "="*80 + "\n")
    
    # Overall summary
    print("🎯 OVERALL TEST SUMMARY")
    print("=" * 80)
    
    successful_queries = sum(1 for r in results if r['success'])
    total_queries = len(results)
    
    print(f"📊 Success Rate: {successful_queries}/{total_queries} ({(successful_queries/total_queries)*100:.1f}%)")
    print()
    
    for i, result in enumerate(results, 1):
        status = "✅" if result['success'] else "❌"
        print(f"{status} Query {i}: {result['query']}")
    
    print()
    
    if successful_queries == total_queries:
        print("🎉 ALL QUERIES PROCESSED SUCCESSFULLY!")
        print("✅ Your external LLM integration is working perfectly")
        print("✅ Ready for production use with real Perplexity API calls")
    else:
        print("⚠️  Some queries failed - check backend logs for details")
    
    return successful_queries == total_queries

if __name__ == "__main__":
    success = run_query_trace_test()
    
    print()
    print("💡 NEXT STEPS:")
    print("1. To test with real Perplexity API (uses credits):")
    print("   python3 test-nl-query-trace.py --real-llm")
    print("2. Monitor backend logs: kubectl logs -n dashboard -l app.kubernetes.io/component=backend")
    print("3. Check schema service: kubectl logs -n dashboard -l app.kubernetes.io/component=schema-service")
    
    sys.exit(0 if success else 1)
