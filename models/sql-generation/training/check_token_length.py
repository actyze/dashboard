from transformers import AutoTokenizer

# Load the CodeT5+ tokenizer
tokenizer = AutoTokenizer.from_pretrained('Salesforce/codet5p-770m')

# Example: check token count for first 10 training examples
import json
with open('trino_train_sample.json') as f:
    data = json.load(f)

for i, example in enumerate(data[:10]):
    input_tokens = tokenizer.tokenize(example['input_text'])
    target_tokens = tokenizer.tokenize(example['target_text'])
    print(f"Example {i+1}:")
    print(f"  input_text tokens: {len(input_tokens)}")
    print(f"  target_text tokens: {len(target_tokens)}")
    print()
