# AI Gateway Service

The AI Gateway service is responsible for routing messages to different AI providers (OpenAI, Anthropic, Cohere, local LLMs, etc.) and publishing AI responses back to the chat system.

## Architecture

```
ai.message.created (Kafka)
  ↓
AI Gateway Service
  ↓
[OpenAI Provider | Anthropic Provider | Cohere Provider | Local LLM Provider]
  ↓
ai.message.reply (Kafka)
  ↓
Chat Service
```

## Features

- **Multi-Provider Support**: Supports OpenAI, Anthropic, Cohere, and local LLMs (Azure-hosted, etc.)
- **Agent Profile Caching**: Maintains a local cache of agent profiles for fast lookups
- **Parallel Processing**: Processes multiple AI receivers in parallel
- **Error Handling**: Gracefully handles provider errors without blocking other agents
- **Rate Limiting**: Respects agent-level rate limits (future enhancement)

## Environment Variables

```bash
MONGO_URI=mongodb://...
KAFKA_CLIENT_ID=ai-gateway
KAFKA_BROKER_URL=kafka:9092
```

## Provider Configuration

### OpenAI
- Requires `OPENAI_API_KEY` environment variable or API key in agent profile
- Models: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`, etc.

### Anthropic
- Requires `ANTHROPIC_API_KEY` environment variable or API key in agent profile
- Models: `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`, etc.

### Cohere
- Requires `COHERE_API_KEY` environment variable or API key in agent profile
- Models: `command-r-plus`, `command-r`, `command-light`, etc.

### Local LLM
- Requires `LOCAL_LLM_ENDPOINT` or endpoint in agent profile
- Compatible with OpenAI-compatible APIs (vLLM, Ollama, etc.)
- Example: `http://localhost:8000/v1/chat/completions`

## Future Enhancements

- [ ] Moderation event handling
- [ ] Rate limiting enforcement
- [ ] Response caching
- [ ] Streaming responses
- [ ] Tool/function calling support
- [ ] Multi-turn conversation context
- [ ] Cost tracking and billing integration

