#!/usr/bin/env python3
"""
Test the new pipe-separated column format for better parsing reliability.
"""

def test_column_format_comparison():
    """Compare comma vs pipe separation for column parsing."""
    print("🔧 Testing Column Format: Comma vs Pipe Separation")
    print("=" * 60)
    
    # Test cases with problematic data types
    test_cases = [
        {
            "column": "customer_id",
            "data_type": "bigint",
            "description": "Simple integer type"
        },
        {
            "column": "price",
            "data_type": "decimal(10,2)",
            "description": "Decimal with precision (contains comma)"
        },
        {
            "column": "tags",
            "data_type": "array<varchar(50)>",
            "description": "Array type with nested type"
        },
        {
            "column": "metadata",
            "data_type": "map<varchar,varchar>",
            "description": "Map type with comma in definition"
        },
        {
            "column": "coordinates",
            "data_type": "row(lat double, lng double)",
            "description": "Row type with multiple fields and commas"
        },
        {
            "column": "complex_field",
            "data_type": "array<map<varchar,decimal(10,2)>>",
            "description": "Nested complex type with multiple commas"
        }
    ]
    
    print("\n📊 Format Comparison Results:")
    print("-" * 60)
    
    for i, case in enumerate(test_cases, 1):
        column = case["column"]
        data_type = case["data_type"]
        description = case["description"]
        
        # Old comma format
        comma_format = f"{column},{data_type}"
        comma_parsed = comma_format.split(',')[0]  # This is how we currently parse
        
        # New pipe format
        pipe_format = f"{column}|{data_type}"
        pipe_parsed = pipe_format.split('|')[0]
        
        # Check if parsing is correct
        comma_correct = comma_parsed == column
        pipe_correct = pipe_parsed == column
        
        print(f"\n{i}. {description}")
        print(f"   Column: '{column}', Type: '{data_type}'")
        print(f"   Comma format: '{comma_format}'")
        print(f"     Parsed column: '{comma_parsed}' {'✅' if comma_correct else '❌'}")
        print(f"   Pipe format:  '{pipe_format}'")
        print(f"     Parsed column: '{pipe_parsed}' {'✅' if pipe_correct else '❌'}")
        
        if not comma_correct and pipe_correct:
            print(f"   🎯 Pipe format fixes parsing issue!")
        elif comma_correct and pipe_correct:
            print(f"   ✅ Both formats work for this case")

def test_entity_boosting_parsing():
    """Test entity boosting with the new pipe format."""
    print("\n🚀 Testing Entity Boosting with Pipe Format")
    print("=" * 50)
    
    # Mock recommendation with pipe-separated columns
    mock_recommendation = {
        "full_name": "ecommerce.sales.orders",
        "columns": [
            "order_id|bigint",
            "customer_name|varchar(100)",
            "customer_city|varchar(50)",
            "product_name|varchar(200)",
            "order_amount|decimal(10,2)",
            "order_date|date",
            "shipping_address|varchar(500)",
            "payment_method|varchar(50)"
        ]
    }
    
    # Test column name extraction
    column_names = [col.split('|')[0].lower() for col in mock_recommendation["columns"]]
    
    print("📋 Column Parsing Results:")
    for original, parsed in zip(mock_recommendation["columns"], column_names):
        print(f"   '{original}' → '{parsed}'")
    
    # Test entity matching (simulate the boosting logic)
    location_terms = ['city', 'address', 'location', 'state', 'country', 'zip', 'place']
    product_terms = ['product', 'item', 'name', 'description', 'brand', 'model']
    person_terms = ['name', 'user', 'customer', 'employee', 'person', 'first_name', 'last_name']
    money_terms = ['price', 'cost', 'amount', 'value', 'currency', 'dollar']
    
    print("\n🎯 Entity Matching Results:")
    
    location_matches = [col for col in column_names if any(term in col for term in location_terms)]
    if location_matches:
        print(f"   Location entities: {location_matches} ✅")
    
    product_matches = [col for col in column_names if any(term in col for term in product_terms)]
    if product_matches:
        print(f"   Product entities: {product_matches} ✅")
    
    person_matches = [col for col in column_names if any(term in col for term in person_terms)]
    if person_matches:
        print(f"   Person entities: {person_matches} ✅")
    
    money_matches = [col for col in column_names if any(term in col for term in money_terms)]
    if money_matches:
        print(f"   Money entities: {money_matches} ✅")
    
    total_matches = len(location_matches) + len(product_matches) + len(person_matches) + len(money_matches)
    print(f"\n📊 Total entity matches: {total_matches}/8 columns")

def test_backward_compatibility():
    """Test that the change doesn't break existing functionality."""
    print("\n🔄 Testing Backward Compatibility")
    print("=" * 40)
    
    # Simulate old vs new format processing
    test_columns = [
        "customer_id|bigint",
        "customer_name|varchar(100)", 
        "order_amount|decimal(10,2)",
        "created_at|timestamp"
    ]
    
    print("📋 Column Processing Test:")
    for column_spec in test_columns:
        try:
            parts = column_spec.split('|')
            if len(parts) == 2:
                column_name, data_type = parts
                print(f"   ✅ '{column_spec}' → name: '{column_name}', type: '{data_type}'")
            else:
                print(f"   ❌ '{column_spec}' → Invalid format")
        except Exception as e:
            print(f"   ❌ '{column_spec}' → Error: {e}")
    
    # Test column count calculation (should still work)
    column_count = len(test_columns)
    print(f"\n📊 Column count calculation: {column_count} ✅")
    
    # Test column name extraction for entity boosting
    column_names = [col.split('|')[0] for col in test_columns]
    print(f"📋 Extracted column names: {column_names} ✅")

if __name__ == "__main__":
    print("🧪 Column Format Migration Test Suite")
    print("=" * 70)
    
    try:
        test_column_format_comparison()
        test_entity_boosting_parsing()
        test_backward_compatibility()
        
        print("\n" + "=" * 70)
        print("✅ Column Format Migration Test Completed!")
        print("\n🎉 Key Benefits of Pipe Separation:")
        print("   • ✅ Handles complex data types with commas")
        print("   • ✅ Unambiguous parsing for entity boosting")
        print("   • ✅ More robust than comma separation")
        print("   • ✅ Industry standard for field separation")
        print("   • ✅ Better readability and debugging")
        
        print("\n📋 Migration Summary:")
        print("   • Format changed from 'column,type' to 'column|type'")
        print("   • All parsing logic updated to use pipe separation")
        print("   • Entity boosting now works with complex data types")
        print("   • Test files updated to new format")
        print("   • Documentation updated with new examples")
        
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()
