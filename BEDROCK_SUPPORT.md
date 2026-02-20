# AWS Bedrock Support - Implementation Summary

## Issue
Customer reported that Actyze only works with OpenAI-compatible formats and does not support AWS Bedrock's Converse API.

## Root Cause
Nexus LLM service (`nexus/app/services/llm_service.py`) was sending OpenAI-compatible request format for all providers:
```json
{
  "model": "...",
  "messages": [...],
  "max_tokens": 4096,
  "temperature": 0.1
}
```

But AWS Bedrock Converse API requires a different format:
```json
{
  "messages": [{"role": "user", "content": [{"text": "..."}]}],
  "inferenceConfig": {"maxTokens": 4096, "temperature": 0.1}
}
```

## Solution Implemented

### 1. Code Changes (`nexus/app/services/llm_service.py`)

#### Request Formatting
Added provider-specific request formatting:
- Detects when `EXTERNAL_LLM_PROVIDER=bedrock`
- Converts messages to Bedrock format with nested content blocks
- Uses `inferenceConfig` instead of top-level parameters
- Model ID is in the endpoint URL, not in the request body

#### Response Parsing
Added Bedrock response parsing:
- Extracts content from: `response.output.message.content[0].text`
- Handles Bedrock's nested response structure

### 2. Documentation Updates

#### Updated Files:
- `dashboard-docker/LLM_PROVIDERS.md` - Added Bedrock section
- `dashboard-docker/env.example` - Added OPTION 5: AWS Bedrock
- `dashboard-marketing/apps/docs/docs/configuration/llm-providers.md` - Added Bedrock provider docs

#### Configuration Example:
```bash
EXTERNAL_LLM_PROVIDER=bedrock
ANTHROPIC_API_KEY=bedrock-api-key-YOUR-BEARER-TOKEN
EXTERNAL_LLM_AUTH_TYPE=bearer
EXTERNAL_LLM_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
EXTERNAL_LLM_BASE_URL=https://bedrock-runtime.us-east-2.amazonaws.com/model/us.anthropic.claude-sonnet-4-5-20250929-v1:0/converse
EXTERNAL_LLM_MAX_TOKENS=8192
EXTERNAL_LLM_TEMPERATURE=0.1
```

## Supported Providers (After This Fix)

| Provider | Format | Status |
|----------|--------|--------|
| Anthropic Claude | Anthropic API | ✅ Supported |
| OpenAI | OpenAI API | ✅ Supported |
| Perplexity | OpenAI-compatible | ✅ Supported |
| Groq | OpenAI-compatible | ✅ Supported |
| Azure OpenAI | OpenAI-compatible | ✅ Supported |
| Together AI | OpenAI-compatible | ✅ Supported |
| **AWS Bedrock** | **Bedrock Converse API** | **✅ NOW SUPPORTED** |

## Testing

### Prerequisites
1. AWS account with Bedrock access
2. IAM user with `bedrock:InvokeModel` permission
3. Model access granted in AWS Bedrock console
4. Bearer token generated (valid for 12 hours)

### Test Steps
1. Update `.env` with Bedrock configuration
2. Restart Nexus: `docker-compose restart nexus`
3. Open dashboard and try a natural language query
4. Check logs for successful Bedrock API calls

### Expected Behavior
- ✅ No more `400 Bad Request` errors
- ✅ Bedrock accepts the request format
- ✅ SQL is generated successfully
- ✅ Logs show: "External LLM API call succeeded"

## Important Notes

### Bearer Token Expiration
AWS Bedrock bearer tokens expire after **12 hours**. For production:
- Implement automated token refresh
- Use AWS SDK to generate new tokens before expiration
- Consider using IAM roles with instance profiles (for EC2/ECS deployments)

### Endpoint Format
The model ID must be included in the endpoint URL:
```
https://bedrock-runtime.{region}.amazonaws.com/model/{model-id}/converse
```

### Available Models
- `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (Recommended)
- `us.anthropic.claude-opus-4-20250514-v1:0` (Most powerful)
- `us.anthropic.claude-3-5-sonnet-20241022-v2:0` (Fast)

## Files Modified
1. `dashboard/nexus/app/services/llm_service.py` - Added Bedrock support
2. `dashboard-docker/LLM_PROVIDERS.md` - Documentation
3. `dashboard-docker/env.example` - Configuration example
4. `dashboard-marketing/apps/docs/docs/configuration/llm-providers.md` - User docs

## Next Steps
1. Test with customer's Bedrock setup
2. Build and push new Docker images to Docker Hub
3. Provide bearer token refresh script/guidance
4. Update Helm chart documentation

## Related Documentation
- [AWS Bedrock Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html)
- [Bedrock Authentication](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html)
