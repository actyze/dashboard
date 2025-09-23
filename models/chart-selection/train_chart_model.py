#!/usr/bin/env python3
"""
Train a lightweight ML model for intelligent chart type selection.
Uses DistilBERT to understand data patterns and query context for optimal visualization.
"""

import json
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib
import logging
from typing import List, Dict, Any, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChartModelTrainer:
    def __init__(self):
        self.chart_types = [
            'line', 'bar', 'column', 'pie', 'scatter', 'area', 
            'heatmap', 'treemap', 'funnel', 'gauge', 'histogram', 
            'box', 'violin', 'radar', 'sankey'
        ]
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.label_encoder = LabelEncoder()
        
    def generate_training_data(self, n_samples: int = 2000) -> List[Dict[str, Any]]:
        """Generate synthetic training data for chart selection."""
        training_data = []
        
        # Define patterns for different chart types
        patterns = {
            'line': {
                'has_temporal': True, 'numeric_count': [1, 2], 'categorical_count': [0, 1],
                'row_count_range': (10, 1000), 'keywords': ['trend', 'time', 'over time', 'timeline']
            },
            'bar': {
                'has_temporal': False, 'numeric_count': [1, 2], 'categorical_count': [1, 2],
                'row_count_range': (3, 50), 'keywords': ['compare', 'comparison', 'categories']
            },
            'pie': {
                'has_temporal': False, 'numeric_count': [1], 'categorical_count': [1],
                'row_count_range': (3, 10), 'keywords': ['proportion', 'percentage', 'share']
            },
            'scatter': {
                'has_temporal': False, 'numeric_count': [2, 3], 'categorical_count': [0, 1],
                'row_count_range': (20, 1000), 'keywords': ['correlation', 'relationship', 'scatter']
            },
            'histogram': {
                'has_temporal': False, 'numeric_count': [1], 'categorical_count': [0],
                'row_count_range': (50, 1000), 'keywords': ['distribution', 'frequency', 'histogram']
            },
            'gauge': {
                'has_temporal': False, 'numeric_count': [1], 'categorical_count': [0],
                'row_count_range': (1, 2), 'keywords': ['kpi', 'metric', 'single value', 'gauge']
            },
            'heatmap': {
                'has_temporal': False, 'numeric_count': [1, 2], 'categorical_count': [2, 3],
                'row_count_range': (20, 500), 'keywords': ['heatmap', 'matrix', 'correlation matrix']
            },
            'treemap': {
                'has_temporal': False, 'numeric_count': [1, 2], 'categorical_count': [1, 2],
                'row_count_range': (10, 100), 'keywords': ['hierarchy', 'treemap', 'nested']
            }
        }
        
        for chart_type, pattern in patterns.items():
            samples_per_type = n_samples // len(patterns)
            
            for _ in range(samples_per_type):
                # Generate features based on pattern
                has_temporal = pattern['has_temporal']
                numeric_count = np.random.choice(pattern['numeric_count'])
                categorical_count = np.random.choice(pattern['categorical_count'])
                row_count = np.random.randint(*pattern['row_count_range'])
                
                # Add some noise to make it more realistic
                if np.random.random() < 0.1:  # 10% noise
                    has_temporal = not has_temporal
                    numeric_count = max(0, numeric_count + np.random.randint(-1, 2))
                    categorical_count = max(0, categorical_count + np.random.randint(-1, 2))
                
                # Generate query context
                query_keywords = np.random.choice(pattern['keywords'], 
                                                size=np.random.randint(0, 3), 
                                                replace=False)
                query_context = ' '.join(query_keywords) if len(query_keywords) > 0 else ''
                
                training_data.append({
                    'has_temporal': has_temporal,
                    'numeric_count': numeric_count,
                    'categorical_count': categorical_count,
                    'row_count': row_count,
                    'query_context': query_context,
                    'chart_type': chart_type
                })
        
        return training_data
    
    def extract_features(self, data_point: Dict[str, Any]) -> List[float]:
        """Extract numerical features from data point."""
        features = [
            float(data_point['has_temporal']),
            float(data_point['numeric_count']),
            float(data_point['categorical_count']),
            np.log1p(data_point['row_count']),  # Log transform for row count
        ]
        
        # Add query context features (keyword presence)
        query = data_point['query_context'].lower()
        keyword_features = [
            float('trend' in query or 'time' in query),
            float('compare' in query or 'comparison' in query),
            float('distribution' in query or 'frequency' in query),
            float('correlation' in query or 'relationship' in query),
            float('proportion' in query or 'percentage' in query),
            float('kpi' in query or 'metric' in query),
            float('hierarchy' in query or 'nested' in query),
        ]
        
        return features + keyword_features
    
    def train_model(self, training_data: List[Dict[str, Any]]) -> Tuple[float, str]:
        """Train the chart selection model."""
        logger.info(f"Training on {len(training_data)} samples")
        
        # Extract features and labels
        X = np.array([self.extract_features(dp) for dp in training_data])
        y = [dp['chart_type'] for dp in training_data]
        
        # Encode labels
        y_encoded = self.label_encoder.fit_transform(y)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
        )
        
        # Train model
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        # Get class names for report
        class_names = self.label_encoder.classes_
        report = classification_report(y_test, y_pred, target_names=class_names)
        
        logger.info(f"Model accuracy: {accuracy:.3f}")
        logger.info(f"Classification report:\n{report}")
        
        return accuracy, report
    
    def save_model(self, model_path: str = "chart_selection_model.joblib"):
        """Save the trained model and label encoder."""
        model_data = {
            'model': self.model,
            'label_encoder': self.label_encoder,
            'feature_names': [
                'has_temporal', 'numeric_count', 'categorical_count', 'log_row_count',
                'has_trend_keywords', 'has_compare_keywords', 'has_distribution_keywords',
                'has_correlation_keywords', 'has_proportion_keywords', 'has_kpi_keywords',
                'has_hierarchy_keywords'
            ]
        }
        
        joblib.dump(model_data, model_path)
        logger.info(f"Model saved to {model_path}")
    
    def load_model(self, model_path: str = "chart_selection_model.joblib"):
        """Load a trained model."""
        model_data = joblib.load(model_path)
        self.model = model_data['model']
        self.label_encoder = model_data['label_encoder']
        logger.info(f"Model loaded from {model_path}")
    
    def predict_chart_type(self, data_analysis: Dict[str, Any], query_context: str = "") -> Tuple[str, float]:
        """Predict the best chart type for given data characteristics."""
        data_point = {
            'has_temporal': data_analysis.get('has_temporal', False),
            'numeric_count': len(data_analysis.get('numeric_columns', [])),
            'categorical_count': len(data_analysis.get('categorical_columns', [])),
            'row_count': data_analysis.get('row_count', 1),
            'query_context': query_context
        }
        
        features = np.array([self.extract_features(data_point)])
        
        # Get prediction and probability
        prediction = self.model.predict(features)[0]
        probabilities = self.model.predict_proba(features)[0]
        
        chart_type = self.label_encoder.inverse_transform([prediction])[0]
        confidence = float(np.max(probabilities))
        
        return chart_type, confidence

def main():
    """Train and save the chart selection model."""
    trainer = ChartModelTrainer()
    
    # Generate training data
    logger.info("Generating training data...")
    training_data = trainer.generate_training_data(n_samples=3000)
    
    # Train model
    logger.info("Training model...")
    accuracy, report = trainer.train_model(training_data)
    
    # Save model
    trainer.save_model("chart_selection_model.joblib")
    
    # Test prediction
    test_data = {
        'has_temporal': True,
        'numeric_columns': ['value'],
        'categorical_columns': [],
        'row_count': 100
    }
    
    chart_type, confidence = trainer.predict_chart_type(test_data, "show trend over time")
    logger.info(f"Test prediction: {chart_type} (confidence: {confidence:.3f})")

if __name__ == "__main__":
    main()
