#!/usr/bin/env python3
"""
Enhanced ML-based chart selector using trained model for intelligent visualization selection.
Replaces the rule-based system with a trained RandomForest model.
"""

import json
import pandas as pd
import numpy as np
import joblib
import logging
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ChartRecommendation:
    chart_type: str
    confidence: float
    reasoning: str
    config: Dict[str, Any]

class EnhancedChartSelector:
    """
    ML-based chart selector using trained RandomForest model for intelligent
    chart type selection based on data characteristics and query context.
    """
    
    def __init__(self, model_path: str = "chart_selection_model.joblib"):
        self.model = None
        self.label_encoder = None
        self.feature_names = []
        self.model_path = model_path
        
        # Chart type configurations for different visualization libraries
        self.chart_configs = {
            'line': {'temporal': True, 'best_for': 'time series data'},
            'bar': {'temporal': False, 'best_for': 'categorical comparisons'},
            'column': {'temporal': False, 'best_for': 'categorical comparisons'},
            'pie': {'temporal': False, 'best_for': 'proportional data'},
            'scatter': {'temporal': False, 'best_for': 'correlation analysis'},
            'area': {'temporal': True, 'best_for': 'time series with volume'},
            'heatmap': {'temporal': False, 'best_for': 'matrix data'},
            'treemap': {'temporal': False, 'best_for': 'hierarchical data'},
            'funnel': {'temporal': False, 'best_for': 'process flow'},
            'gauge': {'temporal': False, 'best_for': 'single KPI values'},
            'histogram': {'temporal': False, 'best_for': 'distribution analysis'},
            'box': {'temporal': False, 'best_for': 'statistical distribution'},
            'violin': {'temporal': False, 'best_for': 'distribution comparison'},
            'radar': {'temporal': False, 'best_for': 'multi-dimensional comparison'},
            'sankey': {'temporal': False, 'best_for': 'flow diagrams'}
        }
        
        self.load_model()
    
    def load_model(self):
        """Load the trained chart selection model."""
        try:
            if os.path.exists(self.model_path):
                model_data = joblib.load(self.model_path)
                self.model = model_data['model']
                self.label_encoder = model_data['label_encoder']
                self.feature_names = model_data.get('feature_names', [])
                logger.info("ML-based chart selection model loaded successfully")
            else:
                logger.warning(f"Model file {self.model_path} not found. Using fallback logic.")
                self.model = None
        except Exception as e:
            logger.error(f"Failed to load model: {e}. Using fallback logic.")
            self.model = None
    
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
            col_info['min'] = float(series.min())
            col_info['max'] = float(series.max())
            col_info['mean'] = float(series.mean())
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
    
    def extract_features(self, analysis: Dict[str, Any], query_context: str = "") -> List[float]:
        """Extract features for ML model prediction."""
        features = [
            float(analysis.get('has_temporal', False)),
            float(len(analysis.get('numeric_columns', []))),
            float(len(analysis.get('categorical_columns', []))),
            np.log1p(analysis.get('row_count', 1)),  # Log transform for row count
        ]
        
        # Add query context features (keyword presence)
        query = query_context.lower()
        keyword_features = [
            float('trend' in query or 'time' in query or 'over time' in query),
            float('compare' in query or 'comparison' in query),
            float('distribution' in query or 'frequency' in query),
            float('correlation' in query or 'relationship' in query),
            float('proportion' in query or 'percentage' in query or 'share' in query),
            float('kpi' in query or 'metric' in query or 'single' in query),
            float('hierarchy' in query or 'nested' in query or 'tree' in query),
        ]
        
        return features + keyword_features
    
    def predict_with_ml(self, analysis: Dict[str, Any], query_context: str = "") -> Tuple[str, float, str]:
        """Use ML model to predict chart type."""
        features = np.array([self.extract_features(analysis, query_context)])
        
        # Get prediction and probability
        prediction = self.model.predict(features)[0]
        probabilities = self.model.predict_proba(features)[0]
        
        chart_type = self.label_encoder.inverse_transform([prediction])[0]
        confidence = float(np.max(probabilities))
        
        # Get top 3 predictions for reasoning
        top_indices = np.argsort(probabilities)[-3:][::-1]
        top_charts = [self.label_encoder.inverse_transform([idx])[0] for idx in top_indices]
        top_probs = [probabilities[idx] for idx in top_indices]
        
        reasoning = f"ML model prediction: {chart_type} ({confidence:.2f}). "
        reasoning += f"Alternatives: {top_charts[1]} ({top_probs[1]:.2f}), {top_charts[2]} ({top_probs[2]:.2f})"
        
        return chart_type, confidence, reasoning
    
    def predict_with_rules(self, analysis: Dict[str, Any], query_context: str = "") -> Tuple[str, float, str]:
        """Fallback rule-based prediction when ML model is not available."""
        recommendations = []
        
        # Time series data
        if analysis.get('has_temporal') and analysis.get('has_numeric'):
            recommendations.append(('line', 0.9, 'Time series data with numeric values'))
            recommendations.append(('area', 0.8, 'Time series data suitable for area chart'))
        
        # Single numeric value (KPI/metric)
        if analysis.get('row_count', 0) == 1 and len(analysis.get('numeric_columns', [])) == 1:
            recommendations.append(('gauge', 0.95, 'Single metric value'))
        
        # Categorical with numeric (common case)
        if analysis.get('has_categorical') and analysis.get('has_numeric'):
            if analysis.get('row_count', 0) <= 10:
                recommendations.append(('pie', 0.8, 'Small categorical dataset'))
            recommendations.append(('bar', 0.85, 'Categorical data with numeric values'))
            recommendations.append(('column', 0.8, 'Categorical comparison'))
        
        # Multiple numeric columns (correlation analysis)
        if len(analysis.get('numeric_columns', [])) >= 2:
            recommendations.append(('scatter', 0.8, 'Multiple numeric variables for correlation'))
        
        # Large categorical dataset
        if analysis.get('has_categorical') and analysis.get('row_count', 0) > 20:
            recommendations.append(('treemap', 0.7, 'Large categorical dataset'))
            recommendations.append(('heatmap', 0.6, 'Large dataset suitable for heatmap'))
        
        # Distribution analysis
        if len(analysis.get('numeric_columns', [])) == 1 and analysis.get('row_count', 0) > 10:
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
        return best[0], best[1], best[2]
    
    def recommend_chart(self, data: List[Dict], query_context: str = "") -> ChartRecommendation:
        """Recommend the best chart type for the given data and context."""
        analysis = self.analyze_data_structure(data)
        
        if 'error' in analysis:
            return ChartRecommendation('bar', 0.1, analysis['error'], {})
        
        # Use ML model if available, otherwise fallback to rules
        if self.model is not None:
            chart_type, confidence, reasoning = self.predict_with_ml(analysis, query_context)
        else:
            chart_type, confidence, reasoning = self.predict_with_rules(analysis, query_context)
        
        # Generate chart configuration
        config = self._generate_chart_config(chart_type, analysis, data)
        
        return ChartRecommendation(chart_type, confidence, reasoning, config)
    
    def _generate_chart_config(self, chart_type: str, analysis: Dict, data: List[Dict]) -> Dict[str, Any]:
        """Generate chart configuration for various visualization libraries."""
        config = {
            'type': chart_type,
            'data': data,
            'width': 800,
            'height': 400,
            'title': f'{chart_type.title()} Chart'
        }
        
        # Add type-specific configurations
        if chart_type in ['bar', 'column']:
            if analysis.get('categorical_columns') and analysis.get('numeric_columns'):
                config['xField'] = analysis['categorical_columns'][0]
                config['yField'] = analysis['numeric_columns'][0]
        
        elif chart_type == 'line':
            if analysis.get('temporal_columns') and analysis.get('numeric_columns'):
                config['xField'] = analysis['temporal_columns'][0]
                config['yField'] = analysis['numeric_columns'][0]
                config['smooth'] = True
        
        elif chart_type == 'pie':
            if analysis.get('categorical_columns') and analysis.get('numeric_columns'):
                config['angleField'] = analysis['numeric_columns'][0]
                config['colorField'] = analysis['categorical_columns'][0]
        
        elif chart_type == 'scatter':
            if len(analysis.get('numeric_columns', [])) >= 2:
                config['xField'] = analysis['numeric_columns'][0]
                config['yField'] = analysis['numeric_columns'][1]
                if analysis.get('categorical_columns'):
                    config['colorField'] = analysis['categorical_columns'][0]
        
        elif chart_type == 'gauge':
            if analysis.get('numeric_columns'):
                value = data[0][analysis['numeric_columns'][0]] if data else 0
                config['percent'] = min(1.0, max(0.0, value / 100))
                config['range'] = {'color': ['#30BF78', '#FAAD14', '#F4664A']}
        
        elif chart_type == 'heatmap':
            if len(analysis.get('categorical_columns', [])) >= 2 and analysis.get('numeric_columns'):
                config['xField'] = analysis['categorical_columns'][0]
                config['yField'] = analysis['categorical_columns'][1]
                config['colorField'] = analysis['numeric_columns'][0]
        
        return config

def create_chart_recommendation(data: List[Dict], query_context: str = "") -> Dict[str, Any]:
    """Main function to get enhanced ML-based chart recommendation."""
    selector = EnhancedChartSelector()
    recommendation = selector.recommend_chart(data, query_context)
    
    return {
        'chart_type': recommendation.chart_type,
        'confidence': recommendation.confidence,
        'reasoning': recommendation.reasoning,
        'config': recommendation.config,
        'model_used': 'ML' if selector.model is not None else 'Rules'
    }

if __name__ == "__main__":
    # Test with sample data
    sample_data = [
        {'date': '2024-01-01', 'sales': 100, 'region': 'North'},
        {'date': '2024-01-02', 'sales': 150, 'region': 'South'},
        {'date': '2024-01-03', 'sales': 80, 'region': 'East'}
    ]
    
    result = create_chart_recommendation(sample_data, "show sales trend over time")
    print(json.dumps(result, indent=2))
