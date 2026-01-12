# LLM Provider Configuration for Docker Compose

Actyze Dashboard supports **any LLM provider** with flexible authentication configuration. This guide shows you how to configure different providers.

## Quick Start

1. Copy `env.example` to `.env`
2. Choose your LLM provider from the options below
3. Update the `.env` file with provider-specific settings
4. Run `./start.sh`

---

## Supported Providers

### 🔹 Anthropic Claude (Recommended)

Claude Sonnet 4 offers excellent SQL generation with strong reasoning capabilities.

**Configuration in `.env`:**
```bash
# API Key
PERPLEXITY_API_KEY=your-anthropic-api-key-here

# Provider Settings
EXTERNAL_LLM_PROVIDER=anthropic
EXTERNAL_LLM_BASE_URL=https://api.anthropic.com/v1/messages
EXTERNAL_LLM_MODEL=claude-sonnet-4-20250514
EXTERNAL_LLM_AUTH_TYPE=x-api-key
EXTERNAL_LLM_EXTRA_HEADERS={"anthropic-version": "2023-06-01"}
EXTERNAL_LLM_MAX_TOKENS=4096
EXTERNAL_LLM_TEMPERATURE=0.1
```

**Get API Key:** https://console.anthropic.com/settings/keys

**Available Models:**
- `claude-sonnet-4-20250514` (recommended)
- `claude-3-5-sonnet-20241022`
- `claude-opus-4-20250514` (most powerful)

---

### 🔹 OpenAI

Industry-standard models with excellent performance.

**Configuration in `.env`:**
```bash
# API Key
PERPLEXITY_API_KEY=your-openai-api-key-here

# Provider Settings
EXTERNAL_LLM_PROVIDER=openai
EXTERNAL_LLM_BASE_URL=https://api.openai.com/v1/chat/completions
EXTERNAL_LLM_MODEL=gpt-4o
EXTERNAL_LLM_AUTH_TYPE=bearer
EXTERNAL_LLM_EXTRA_HEADERS=
EXTERNAL_LLM_MAX_TOKENS=4096
EXTERNAL_LLM_TEMPERATURE=0.1
```

**Get API Key:** https://platform.openai.com/api-keys

**Available Models:**
- `gpt-4o` (recommended)
- `gpt-4-turbo`
- `gpt-3.5-turbo` (faster, cheaper)

---

### 🔹 Perplexity (Default)

Fast reasoning models with internet search capabilities.

**Configuration in `.env`:**
```bash
# API Key
PERPLEXITY_API_KEY=your-perplexity-api-key-here

# Provider Settings
EXTERNAL_LLM_PROVIDER=perplexity
EXTERNAL_LLM_BASE_URL=https://api.perplexity.ai/chat/completions
EXTERNAL_LLM_MODEL=sonar-reasoning-pro
EXTERNAL_LLM_AUTH_TYPE=bearer
EXTERNAL_LLM_EXTRA_HEADERS=
EXTERNAL_LLM_MAX_TOKENS=4096
EXTERNAL_LLM_TEMPERATURE=0.1
```

**Get API Key:** https://www.perplexity.ai/settings/api

**Available Models:**
- `sonar-reasoning-pro` (recommended)
- `sonar-pro`
- `sonar`

---

### 🔹 Groq

Ultra-fast inference with open-source models.

**Configuration in `.env`:**
```bash
# API Key
PERPLEXITY_API_KEY=your-groq-api-key-here

# Provider Settings
EXTERNAL_LLM_PROVIDER=groq
EXTERNAL_LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
EXTERNAL_LLM_MODEL=llama-3.3-70b-versatile
EXTERNAL_LLM_AUTH_TYPE=bearer
EXTERNAL_LLM_EXTRA_HEADERS=
EXTERNAL_LLM_MAX_TOKENS=4096
EXTERNAL_LLM_TEMPERATURE=0.1
```

**Get API Key:** https://console.groq.com/keys

**Available Models:**
- `llama-3.3-70b-versatile` (recommended)
- `mixtral-8x7b-32768`
- `gemma2-9b-it`

---

### 🔹 Together AI

Wide selection of open-source models.

**Configuration in `.env`:**
```bash
# API Key
PERPLEXITY_API_KEY=your-together-api-key-here

# Provider Settings
EXTERNAL_LLM_PROVIDER=together
EXTERNAL_LLM_BASE_URL=https://api.together.xyz/v1/chat/completions
EXTERNAL_LLM_MODEL=meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo
EXTERNAL_LLM_AUTH_TYPE=bearer
EXTERNAL_LLM_EXTRA_HEADERS=
EXTERNAL_LLM_MAX_TOKENS=4096
EXTERNAL_LLM_TEMPERATURE=0.1
```

**Get API Key:** https://api.together.xyz/settings/api-keys

---

### 🔹 Azure OpenAI

Enterprise OpenAI deployment on Azure.

**Configuration in `.env`:**
```bash
# API Key
PERPLEXITY_API_KEY=your-azure-api-key-here

# Provider Settings
EXTERNAL_LLM_PROVIDER=azure-openai
EXTERNAL_LLM_BASE_URL=https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=2024-08-01-preview
EXTERNAL_LLM_MODEL=gpt-4o  # Your deployment name
EXTERNAL_LLM_AUTH_TYPE=api-key
EXTERNAL_LLM_EXTRA_HEADERS=
EXTERNAL_LLM_MAX_TOKENS=4096
EXTERNAL_LLM_TEMPERATURE=0.1
```

**Note:** Replace `YOUR-RESOURCE` and `YOUR-DEPLOYMENT` with your Azure OpenAI resource details.

---

### 🔹 Custom Provider

You can use any OpenAI-compatible API endpoint.

**Configuration in `.env`:**
```bash
# API Key
PERPLEXITY_API_KEY=your-custom-api-key-here

# Provider Settings
EXTERNAL_LLM_PROVIDER=custom
EXTERNAL_LLM_BASE_URL=https://your-custom-endpoint.com/v1/chat/completions
EXTERNAL_LLM_MODEL=your-model-name
EXTERNAL_LLM_AUTH_TYPE=bearer  # or x-api-key, api-key
EXTERNAL_LLM_EXTRA_HEADERS={"custom-header": "value"}
EXTERNAL_LLM_MAX_TOKENS=4096
EXTERNAL_LLM_TEMPERATURE=0.1
```

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EXTERNAL_LLM_ENABLED` | Enable/disable external LLM | `true` |
| `EXTERNAL_LLM_PROVIDER` | Provider name (for logging) | `perplexity` |
| `EXTERNAL_LLM_BASE_URL` | Full API endpoint URL | - |
| `EXTERNAL_LLM_MODEL` | Model name/identifier | - |
| `EXTERNAL_LLM_AUTH_TYPE` | Authentication method | `bearer` |
| `EXTERNAL_LLM_EXTRA_HEADERS` | Additional HTTP headers (JSON) | `{}` |
| `EXTERNAL_LLM_MAX_TOKENS` | Maximum response tokens | `4096` |
| `EXTERNAL_LLM_TEMPERATURE` | Creativity (0.0 - 1.0) | `0.1` |
| `PERPLEXITY_API_KEY` | API key for the provider | - |

### Authentication Types

| Type | Header Format | Used By |
|------|---------------|---------|
| `bearer` | `Authorization: Bearer {key}` | OpenAI, Perplexity, Groq, Together AI |
| `x-api-key` | `x-api-key: {key}` | Anthropic Claude |
| `api-key` | `api-key: {key}` | Azure OpenAI |

### Extra Headers

For providers requiring additional headers (like Claude's API version), use JSON format:

```bash
EXTERNAL_LLM_EXTRA_HEADERS={"anthropic-version": "2023-06-01"}
```

**Note:** Use single quotes in shell if your JSON contains double quotes:
```bash
EXTERNAL_LLM_EXTRA_HEADERS='{"custom-header": "value"}'
```

---

## Testing Your Configuration

After updating `.env`, test your LLM configuration:

### 1. Start the services:
```bash
./start.sh
```

### 2. Check Nexus logs for LLM initialization:
```bash
docker logs dashboard-nexus | grep -i "llm\|external"
```

### 3. Test via API:
```bash
# Get authentication token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=nexus_admin&password=admin" | jq -r '.access_token')

# Test SQL generation
curl -X POST http://localhost:8000/api/generate-sql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nl_query":"show me total count of students"}' | jq .
```

### 4. Test via UI:
1. Open http://localhost:3000
2. Login with `nexus_admin` / `admin`
3. Try a natural language query like "show me all customers"

---

## Troubleshooting

### Error: "LLM service authentication failed"

**Cause:** Incorrect `EXTERNAL_LLM_AUTH_TYPE` or missing `EXTERNAL_LLM_EXTRA_HEADERS`.

**Solution:**
- For Claude: Use `EXTERNAL_LLM_AUTH_TYPE=x-api-key` and include `anthropic-version` header
- For OpenAI: Use `EXTERNAL_LLM_AUTH_TYPE=bearer`
- Check API key is correct

### Error: "No response from {provider} API"

**Cause:** The response format doesn't match OpenAI or Anthropic format.

**Solution:** 
- Verify the provider uses OpenAI-compatible API format
- Check `EXTERNAL_LLM_BASE_URL` is correct
- Review provider's API documentation

### Error: "API call failed: 401 Unauthorized"

**Cause:** Invalid or expired API key.

**Solution:**
- Verify API key is correct in `.env`
- Check API key has not expired
- Ensure API key has proper permissions

### Error: "API call failed: 429 Too Many Requests"

**Cause:** Rate limit exceeded.

**Solution:**
- Wait and retry
- Upgrade your provider's plan for higher rate limits
- Reduce request frequency

---

## Cost Optimization

### Token Usage
- Reduce `EXTERNAL_LLM_MAX_TOKENS` if responses are too long
- Most SQL queries need 500-2000 tokens

### Model Selection
- Use smaller models for simpler queries (e.g., `gpt-3.5-turbo` instead of `gpt-4o`)
- Reserve powerful models for complex multi-table queries

### Caching
Nexus caches query results to reduce LLM API calls:

```bash
CACHE_ENABLED=true
CACHE_QUERY_MAX_SIZE=100
CACHE_QUERY_TTL=1800  # 30 minutes
```

---

## Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use environment-specific API keys** - Separate keys for dev/prod
3. **Rotate API keys regularly** - Especially after team changes
4. **Use read-only database credentials** - Trino should only have SELECT permissions
5. **Monitor API usage** - Set up billing alerts with your LLM provider

---

## Provider Comparison

| Provider | Best For | Pros | Cons |
|----------|----------|------|------|
| **Claude** | SQL generation, reasoning | Excellent SQL quality, long context | Higher cost |
| **OpenAI** | General purpose, reliability | Widely supported, consistent | Moderate cost |
| **Perplexity** | Fast responses, internet search | Good balance, fast | Limited model options |
| **Groq** | Speed, open-source | Ultra-fast, free tier | Smaller models |
| **Together AI** | Open-source, customization | Many models, affordable | Variable quality |

---

## Need Help?

- **GitHub Issues:** https://github.com/your-org/dashboard/issues
- **Documentation:** See `/docs` folder
- **Helm Deployment:** See `/helm-charts/dashboard/LLM_PROVIDERS.md` for Kubernetes configuration
