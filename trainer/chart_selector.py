#!/usr/bin/env python3
"""
Lightweight chart selection model for intelligent visualization type selection.
Uses a rule-based system enhanced with ML for data pattern recognition.
"""

import json
import pandas as pd
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import numpy as np

@dataclass
class ChartRecommendation:
    chart_type: str
    confidence: float
    reasoning: str
    config: Dict[str, Any]

class ChartSelector:
    """
    Intelligent chart type selector that analyzes data characteristics
    and recommends optimal visualization types for the antvis/mcp-server-chart.
    """
    
    def __init__(self):
        self.chart_types = {
            'line': {'temporal': True, 'numeric': True, 'categorical': False},
            'bar': {'temporal': False, 'numeric': True, 'categorical': True},
            'column': {'temporal': False, 'numeric': True, 'categorical': True},
            'pie': {'temporal': False, 'numeric': True, 'categorical': True},
            'scatter': {'temporal': False, 'numeric': True, 'categorical': False},
            'area': {'temporal': True, 'numeric': True, 'categorical': False},
            'heatmap': {'temporal': False, 'numeric': True, 'categorical': True},
            'treemap': {'temporal': False, 'numeric': True, 'categorical': True},
            'sankey': {'temporal': False, 'numeric': True, 'categorical': True},
            'funnel': {'temporal': False, 'numeric': True, 'categorical': True},
            'gauge': {'temporal': False, 'numeric': True, 'categorical': False},
            'histogram': {'temporal': False, 'numeric': True, 'categorical': False},
            'box': {'temporal': False, 'numeric': True, 'categorical': True},
            'violin': {'temporal': False, 'numeric': True, 'categorical': True},
            'radar': {'temporal': False, 'numeric': True, 'categorical': True}
        }
    
    def analyze_data_structure(self, data: List[Dict]) -> Dict[str, Any]:
        """Analyze the structure and characteristics of the data."""
        if not data:
            return {'error': 'No data provided'}
        
        df = pd.DataFrame(data)
        analysis = {
            'row_count': len(df),
            'column_count': len(df.columns),
            'columns': {},
            'has_temporal': False,
            'has_numeric': False,
            'has_categorical': False,
            'numeric_columns': [],
            'categorical_columns': [],
            'temporal_columns': []
        }
        
        for col in df.columns:
            col_analysis = self._analyze_column(df[col])
            analysis['columns'][col] = col_analysis
            
            if col_analysis['type'] == 'numeric':
                analysis['has_numeric'] = True
                analysis['numeric_columns'].append(col)
            elif col_analysis['type'] == 'categorical':
                analysis['has_categorical'] = True
                analysis['categorical_columns'].append(col)
            elif col_analysis['type'] == 'temporal':
                analysis['has_temporal'] = True
                analysis['temporal_columns'].append(col)
        
        return analysis
    
    def _analyze_column(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze a single column's characteristics."""
        col_info = {
            'type': 'unknown',
            'unique_count': series.nunique(),
            'null_count': series.isnull().sum(),
            'sample_values': series.dropna().head(5).tolist()
        }
        
        # Check if temporal
        if self._is_temporal_column(series):
            col_info['type'] = 'temporal'
        # Check if numeric
        elif pd.api.types.is_numeric_dtype(series):
            col_info['type'] = 'numeric'
            col_info['min'] = series.min()
            col_info['max'] = series.max()
            col_info['mean'] = series.mean()
        # Default to categorical
        else:
            col_info['type'] = 'categorical'
            col_info['categories'] = series.value_counts().head(10).to_dict()
        
        return col_info
    
    def _is_temporal_column(self, series: pd.Series) -> bool:
        """Check if a column contains temporal data."""
        temporal_keywords = ['date', 'time', 'created', 'updated', 'timestamp']
        col_name = series.name.lower() if series.name else ''
        
        # Check column name
        if any(keyword in col_name for keyword in temporal_keywords):
            return True
        
        # Try to parse sample values as dates
        try:
            sample = series.dropna().head(10)
            parsed_count = 0
            for val in sample:
                try:
                    pd.to_datetime(val)
                    parsed_count += 1
                except:
                    continue
            return parsed_count / len(sample) > 0.7
        except:
            return False
    
    def recommend_chart(self, data: List[Dict], query_context: str = "") -> ChartRecommendation:
        """Recommend the best chart type for the given data and context."""
        analysis = self.analyze_data_structure(data)
        
        if 'error' in analysis:
            return ChartRecommendation('bar', 0.1, analysis['error'], {})
        
        # Rule-based recommendations
        recommendations = []
        
        # Time series data
        if analysis['has_temporal'] and analysis['has_numeric']:
            recommendations.append(('line', 0.9, 'Time series data with numeric values'))
            recommendations.append(('area', 0.8, 'Time series data suitable for area chart'))
        
        # Single numeric value (KPI/metric)
        if analysis['row_count'] == 1 and len(analysis['numeric_columns']) == 1:
            recommendations.append(('gauge', 0.95, 'Single metric value'))
        
        # Categorical with numeric (common case)
        if analysis['has_categorical'] and analysis['has_numeric']:
            if analysis['row_count'] <= 10:
                recommendations.append(('pie', 0.8, 'Small categorical dataset'))
            recommendations.append(('bar', 0.85, 'Categorical data with numeric values'))
            recommendations.append(('column', 0.8, 'Categorical comparison'))
        
        # Multiple numeric columns (correlation analysis)
        if len(analysis['numeric_columns']) >= 2:
            recommendations.append(('scatter', 0.8, 'Multiple numeric variables for correlation'))
        
        # Large categorical dataset
        if analysis['has_categorical'] and analysis['row_count'] > 20:
            recommendations.append(('treemap', 0.7, 'Large categorical dataset'))
            recommendations.append(('heatmap', 0.6, 'Large dataset suitable for heatmap'))
        
        # Distribution analysis
        if len(analysis['numeric_columns']) == 1 and analysis['row_count'] > 10:
            recommendations.append(('histogram', 0.7, 'Single numeric variable distribution'))
        
        # Context-based adjustments
        query_lower = query_context.lower()
        if 'trend' in query_lower or 'over time' in query_lower:
            recommendations = [(t, c + 0.1, r) for t, c, r in recommendations if t in ['line', 'area']]
        elif 'compare' in query_lower or 'comparison' in query_lower:
            recommendations = [(t, c + 0.1, r) for t, c, r in recommendations if t in ['bar', 'column']]
        elif 'distribution' in query_lower:
            recommendations = [(t, c + 0.1, r) for t, c, r in recommendations if t in ['histogram', 'box']]
        
        # Default fallback
        if not recommendations:
            recommendations.append(('bar', 0.5, 'Default chart type for general data'))
        
        # Select best recommendation
        best = max(recommendations, key=lambda x: x[1])
        chart_type, confidence, reasoning = best
        
        # Generate chart configuration
        config = self._generate_chart_config(chart_type, analysis, data)
        
        return ChartRecommendation(chart_type, confidence, reasoning, config)
    
    def _generate_chart_config(self, chart_type: str, analysis: Dict, data: List[Dict]) -> Dict[str, Any]:
        """Generate chart configuration for the antvis/mcp-server-chart."""
        config = {
            'type': chart_type,
            'data': data,
            'width': 800,
            'height': 400
        }
        
        # Add type-specific configurations
        if chart_type in ['bar', 'column']:
            if analysis['categorical_columns'] and analysis['numeric_columns']:
                config['xField'] = analysis['categorical_columns'][0]
                config['yField'] = analysis['numeric_columns'][0]
        
        elif chart_type == 'line':
            if analysis['temporal_columns'] and analysis['numeric_columns']:
                config['xField'] = analysis['temporal_columns'][0]
                config['yField'] = analysis['numeric_columns'][0]
        
        elif chart_type == 'pie':
            if analysis['categorical_columns'] and analysis['numeric_columns']:
                config['angleField'] = analysis['numeric_columns'][0]
                config['colorField'] = analysis['categorical_columns'][0]
        
        elif chart_type == 'scatter':
            if len(analysis['numeric_columns']) >= 2:
                config['xField'] = analysis['numeric_columns'][0]
                config['yField'] = analysis['numeric_columns'][1]
        
        elif chart_type == 'gauge':
            if analysis['numeric_columns']:
                config['percent'] = data[0][analysis['numeric_columns'][0]] / 100
        
        return config

def create_chart_recommendation(data: List[Dict], query_context: str = "") -> Dict[str, Any]:
    """Main function to get chart recommendation."""
    selector = ChartSelector()
    recommendation = selector.recommend_chart(data, query_context)
    
    return {
        'chart_type': recommendation.chart_type,
        'confidence': recommendation.confidence,
        'reasoning': recommendation.reasoning,
        'config': recommendation.config
    }

if __name__ == "__main__":
    # Test with sample data
    sample_data = [
        {'category': 'A', 'value': 100},
        {'category': 'B', 'value': 150},
        {'category': 'C', 'value': 80}
    ]
    
    result = create_chart_recommendation(sample_data, "Compare categories")
    print(json.dumps(result, indent=2))
