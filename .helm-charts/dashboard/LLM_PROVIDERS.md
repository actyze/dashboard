# LLM Provider Configuration Guide

This guide explains how to configure Actyze Dashboard with different LLM providers for natural language to SQL generation.

## Overview

Actyze Dashboard supports **any LLM provider** through a flexible configuration system. You only need to provide:
- API endpoint
- Authentication method
- Model name
- API key

---

## Supported Authentication Types

| Auth Type | Description | Used By |
|-----------|-------------|---------|
| `bearer` | `Authorization: Bearer YOUR_KEY` | OpenAI, Perplexity, Groq, Together AI |
| `x-api-key` | `x-api-key: YOUR_KEY` | Anthropic Claude |
| `api-key` | `api-key: YOUR_KEY` | Azure OpenAI |

---

## Configuration Examples

### 1. Anthropic Claude (Default)

```yaml
# values.yaml
modelStrategy:
  externalLLM:
    enabled: true
    provider: "anthropic"
    model: "claude-sonnet-4-20250514"  # or claude-3-5-sonnet-20241022
    baseUrl: "https://api.anthropic.com/v1/messages"
    authType: "x-api-key"
    extraHeaders: '{"anthropic-version": "2023-06-01"}'
    maxTokens: 4096
    temperature: 0.1
```

```yaml
# values-secrets.yaml
secrets:
  externalLLM:
    apiKey: "sk-ant-api03-YOUR-CLAUDE-API-KEY"
```

**Get API Key**: https://console.anthropic.com/settings/keys

---

### 2. OpenAI

```yaml
# values.yaml
modelStrategy:
  externalLLM:
    enabled: true
    provider: "openai"
    model: "gpt-4"  # or gpt-4-turbo, gpt-3.5-turbo
    baseUrl: "https://api.openai.com/v1/chat/completions"
    authType: "bearer"
    extraHeaders: ''  # No extra headers needed
    maxTokens: 4096
    temperature: 0.1
```

```yaml
# values-secrets.yaml
secrets:
  externalLLM:
    apiKey: "sk-YOUR-OPENAI-API-KEY"
```

**Get API Key**: https://platform.openai.com/api-keys

---

### 3. Perplexity AI

```yaml
# values.yaml
modelStrategy:
  externalLLM:
    enabled: true
    provider: "perplexity"
    model: "sonar-reasoning-pro"  # or llama-3.1-sonar-large-128k-online
    baseUrl: "https://api.perplexity.ai/chat/completions"
    authType: "bearer"
    extraHeaders: ''
    maxTokens: 4096
    temperature: 0.1
```

```yaml
# values-secrets.yaml
secrets:
  externalLLM:
    apiKey: "pplx-YOUR-PERPLEXITY-API-KEY"
```

**Get API Key**: https://www.perplexity.ai/settings/api

---

### 4. Groq

```yaml
# values.yaml
modelStrategy:
  externalLLM:
    enabled: true
    provider: "groq"
    model: "llama3-70b-8192"  # or mixtral-8x7b-32768
    baseUrl: "https://api.groq.com/openai/v1/chat/completions"
    authType: "bearer"
    extraHeaders: ''
    maxTokens: 4096
    temperature: 0.1
```

```yaml
# values-secrets.yaml
secrets:
  externalLLM:
    apiKey: "gsk_YOUR-GROQ-API-KEY"
```

**Get API Key**: https://console.groq.com/keys

---

### 5. Azure OpenAI

```yaml
# values.yaml
modelStrategy:
  externalLLM:
    enabled: true
    provider: "azure"
    model: "YOUR-DEPLOYMENT-NAME"
    baseUrl: "https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT-NAME/chat/completions"
    authType: "api-key"
    extraHeaders: '{"api-version": "2023-05-15"}'
    maxTokens: 4096
    temperature: 0.1
```

```yaml
# values-secrets.yaml
secrets:
  externalLLM:
    apiKey: "YOUR-AZURE-OPENAI-KEY"
```

---

### 6. Together AI

```yaml
# values.yaml
modelStrategy:
  externalLLM:
    enabled: true
    provider: "together"
    model: "meta-llama/Llama-3-70b-chat-hf"
    baseUrl: "https://api.together.xyz/v1/chat/completions"
    authType: "bearer"
    extraHeaders: ''
    maxTokens: 4096
    temperature: 0.1
```

```yaml
# values-secrets.yaml
secrets:
  externalLLM:
    apiKey: "YOUR-TOGETHER-AI-KEY"
```

**Get API Key**: https://api.together.xyz/settings/api-keys

---

### 7. Custom LLM Provider

For any other provider, configure as follows:

```yaml
# values.yaml
modelStrategy:
  externalLLM:
    enabled: true
    provider: "custom-provider-name"
    model: "model-name"
    baseUrl: "https://api.your-provider.com/v1/completions"
    authType: "bearer"  # or "x-api-key" or "api-key"
    extraHeaders: '{"custom-header": "value"}'  # Optional
    maxTokens: 4096
    temperature: 0.1
```

```yaml
# values-secrets.yaml
secrets:
  externalLLM:
    apiKey: "YOUR-API-KEY"
```

---

## Configuration Parameters

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `enabled` | Enable external LLM | `true` |
| `provider` | Provider name (for logging) | `"anthropic"` |
| `model` | Model identifier | `"claude-sonnet-4-20250514"` |
| `baseUrl` | Complete API endpoint | `"https://api.anthropic.com/v1/messages"` |
| `apiKey` | API key (in secrets) | `"sk-ant-..."` |

### Optional Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `authType` | Authentication method | `"bearer"` |
| `extraHeaders` | Additional headers (JSON) | `""` |
| `maxTokens` | Maximum response tokens | `4096` |
| `temperature` | Sampling temperature (0-1) | `0.1` |
| `timeout` | API timeout (seconds) | `30` |

---

## Deployment

### Step 1: Update Configuration

Edit `values.yaml` with your chosen provider settings.

### Step 2: Add API Key

Edit `values-secrets.yaml` and add your API key:

```yaml
secrets:
  externalLLM:
    apiKey: "YOUR-API-KEY-HERE"
```

### Step 3: Deploy/Upgrade

```bash
helm upgrade dashboard ./dashboard \
  -f values.yaml \
  -f values-secrets.yaml \
  -n dashboard \
  --create-namespace
```

---

## Testing

After deployment, test the LLM connection:

```bash
# Port-forward Nexus API
kubectl port-forward svc/dashboard-nexus 8000:8002 -n dashboard

# Test natural language query
curl -X POST http://localhost:8000/api/generate-sql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-USER-TOKEN" \
  -d '{
    "nl_query": "Show me all customers",
    "conversation_history": []
  }'
```

---

## Troubleshooting

### 401 Unauthorized

- **Cause**: Invalid API key or wrong authentication method
- **Fix**: 
  1. Verify API key is correct
  2. Check `authType` matches provider requirements
  3. Ensure `extraHeaders` includes required version headers

### 404 Not Found

- **Cause**: Incorrect `baseUrl`
- **Fix**: Double-check the API endpoint for your provider

### Timeout

- **Cause**: API is slow or unreachable
- **Fix**: Increase `timeout` value or check network connectivity

### Check Nexus Logs

```bash
kubectl logs -n dashboard deployment/dashboard-nexus --tail=100 | grep -i "llm\|error"
```

---

## Provider Comparison

| Provider | Best For | Avg Response Time | Cost (per 1M tokens) |
|----------|----------|-------------------|----------------------|
| **Claude (Anthropic)** | Complex SQL, reasoning | 2-5s | $3 (input) / $15 (output) |
| **GPT-4 (OpenAI)** | General purpose | 3-8s | $2.50 (input) / $10 (output) |
| **Perplexity** | Research, online data | 2-4s | $1 (input) / $5 (output) |
| **Groq** | Speed (on-premise LLMs) | <1s | $0.10 (input) / $0.10 (output) |
| **Together AI** | Open source models | 1-3s | $0.60 (input) / $0.60 (output) |

---

## Recommended Models for SQL Generation

1. **Best Accuracy**: `claude-sonnet-4-20250514` (Anthropic)
2. **Best Speed**: `llama3-70b-8192` (Groq)
3. **Best Cost**: Mixtral models on Together AI
4. **Best Balance**: `gpt-4-turbo` (OpenAI)

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/actyze-platform
- Documentation: https://docs.actyze.com
