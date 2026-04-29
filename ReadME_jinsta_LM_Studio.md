# LM Studio Jinja Chat Template (Qwen3 — API-Controlled Thinking)

## How It Works

The app controls thinking ON/OFF per request. Two mechanisms work together:

1. **Jinja template** — checks `enable_thinking` variable to decide whether to start with `<think>` or not
2. **API request** — sends `chat_template_kwargs: { enable_thinking: true/false }` to set that variable
3. **`/no_think` in system prompt** — additional signal to the model itself

- **Thinking Mode** → `enable_thinking: true` → template starts with `<think>` → model reasons, then answers
- **Quick Mode** → `enable_thinking: false` + `/no_think` in system prompt → template skips `<think>` → model answers directly, fast

## Setup

1. Open **LM Studio → My Models**
2. Select your model (e.g., `qwen3.5-9b-claude-4.6-opus-uncensored-distilled`)
3. Go to **Inference → Prompt Template**
4. **Turn OFF the thinking button in LM Studio UI** (the API controls it now)
5. Replace the entire Jinja template with the one below
6. **Reload the model**

> ⚠️ **Important:** The thinking toggle in LM Studio UI must be **OFF**. If it's ON, it overrides the API and forces thinking on every request.

> ⚠️ **Critical:** The default Qwen3 template does NOT have the `enable_thinking` check — it always forces `<think>`. You MUST use the template below.

---

## Template

The key difference from the default template is at the very end — the `add_generation_prompt` section conditionally adds `<think>` based on `enable_thinking`:

```jinja
{%- if tools %}
    {{- '<|im_start|>system\n' }}
    {%- if messages[0].role == 'system' %}
        {{- messages[0].content + '\n\n' }}
    {%- endif %}
    {{- "# Tools\n\nYou may call one or more functions to assist with the user query.\n\nYou are provided with function signatures within <tools></tools> XML tags:\n<tools>" }}
    {%- for tool in tools %}
        {{- "\n" }}
        {{- tool | tojson }}
    {%- endfor %}
    {{- "\n</tools>\n\nFor each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\n<tool_call>\n{\"name\": <function-name>, \"arguments\": <args-json-object>}\n</tool_call><|im_end|>\n" }}
{%- else %}
    {%- if messages[0].role == 'system' %}
        {{- '<|im_start|>system\n' + messages[0].content + '<|im_end|>\n' }}
    {%- endif %}
{%- endif %}
{%- set ns = namespace(multi_step_tool=true, last_query_index=messages|length - 1) %}
{%- for message in messages[::-1] %}
    {%- set index = (messages|length - 1) - loop.index0 %}
    {%- if ns.multi_step_tool and message.role == "user" and message.content is string and not(message.content.startswith('<tool_response>') and message.content.endswith('</tool_response>')) %}
        {%- set ns.multi_step_tool = false %}
        {%- set ns.last_query_index = index %}
    {%- endif %}
{%- endfor %}
{%- for message in messages %}
    {%- if message.content is string %}
        {%- set content = message.content %}
    {%- else %}
        {%- set content = '' %}
    {%- endif %}
    {%- if (message.role == "user") or (message.role == "system" and not loop.first) %}
        {{- '<|im_start|>' + message.role + '\n' + content + '<|im_end|>' + '\n' }}
    {%- elif message.role == "assistant" %}
        {%- set reasoning_content = '' %}
        {%- if message.reasoning_content is string %}
            {%- set reasoning_content = message.reasoning_content %}
        {%- else %}
            {%- if '</think>' in content %}
                {%- set reasoning_content = content.split('</think>')[0].rstrip('\n').split('<think>')[-1].lstrip('\n') %}
                {%- set content = content.split('</think>')[-1].lstrip('\n') %}
            {%- endif %}
        {%- endif %}
        {%- if loop.index0 > ns.last_query_index %}
            {%- if enable_thinking and (loop.last or (not loop.last and reasoning_content)) %}
                {{- '<|im_start|>' + message.role + '\n<think>\n' + reasoning_content.strip('\n') + '\n</think>\n\n' + content.lstrip('\n') }}
            {%- else %}
                {{- '<|im_start|>' + message.role + '\n' + content }}
            {%- endif %}
        {%- else %}
            {{- '<|im_start|>' + message.role + '\n' + content }}
        {%- endif %}
        {%- if message.tool_calls %}
            {%- for tool_call in message.tool_calls %}
                {%- if (loop.first and content) or (not loop.first) %}
                    {{- '\n' }}
                {%- endif %}
                {%- if tool_call.function %}
                    {%- set tool_call = tool_call.function %}
                {%- endif %}
                {{- '<tool_call>\n{"name": "' }}
                {{- tool_call.name }}
                {{- '", "arguments": ' }}
                {%- if tool_call.arguments is string %}
                    {{- tool_call.arguments }}
                {%- else %}
                    {{- tool_call.arguments | tojson }}
                {%- endif %}
                {{- '}\n</tool_call>' }}
            {%- endfor %}
        {%- endif %}
        {{- '<|im_end|>\n' }}
    {%- elif message.role == "tool" %}
        {%- if loop.first or (messages[loop.index0 - 1].role != "tool") %}
            {{- '<|im_start|>user' }}
        {%- endif %}
        {{- '\n<tool_response>\n' }}
        {{- content }}
        {{- '\n</tool_response>' }}
        {%- if loop.last or (messages[loop.index0 + 1].role != "tool") %}
            {{- '<|im_end|>\n' }}
        {%- endif %}
    {%- endif %}
{%- endfor %}
{%- if add_generation_prompt %}
    {%- if enable_thinking %}
        {{- '<|im_start|>assistant\n<think>\n' }}
    {%- else %}
        {{- '<|im_start|>assistant\n' }}
    {%- endif %}
{%- endif %}
```

---

## What Makes This Different From Default

The **default Qwen3 template** has this at the end:

```jinja
{%- if add_generation_prompt %}
    {{- '<|im_start|>assistant\n<think>\n' }}
{%- endif %}
```

This **always** forces thinking — no condition, no check. Every response starts with `<think>`.

**This template** replaces it with:

```jinja
{%- if add_generation_prompt %}
    {%- if enable_thinking %}
        {{- '<|im_start|>assistant\n<think>\n' }}
    {%- else %}
        {{- '<|im_start|>assistant\n' }}
    {%- endif %}
{%- endif %}
```

Now thinking only happens when `enable_thinking` is `true`.

---

## How the App Controls Thinking

The route.ts sends `chat_template_kwargs` + `/no_think` in the system prompt:

**Quick Mode:**
```json
{
  "messages": [
    {"role": "system", "content": "/no_think"},
    {"role": "user", "content": "Hello"}
  ],
  "stream": true,
  "chat_template_kwargs": {"enable_thinking": false}
}
```

**Thinking Mode:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": true,
  "chat_template_kwargs": {"enable_thinking": true}
}
```

---

## Recommended Settings

### Quick Mode — General Tasks

| Parameter          | Value |
| ------------------ | ----- |
| temperature        | 0.7   |
| top_p              | 0.8   |
| top_k              | 20    |
| min_p              | 0.0   |
| presence_penalty   | 1.5   |
| repetition_penalty | 1.0   |

### Quick Mode — Reasoning Tasks

| Parameter          | Value |
| ------------------ | ----- |
| temperature        | 1.0   |
| top_p              | 0.95  |
| top_k              | 20    |
| min_p              | 0.0   |
| presence_penalty   | 1.5   |
| repetition_penalty | 1.0   |

### Thinking Mode — General Tasks

| Parameter          | Value |
| ------------------ | ----- |
| temperature        | 1.0   |
| top_p              | 0.95  |
| top_k              | 20    |
| min_p              | 0.0   |
| presence_penalty   | 1.5   |
| repetition_penalty | 1.0   |

### Thinking Mode — Precise Coding Tasks

| Parameter          | Value |
| ------------------ | ----- |
| temperature        | 0.6   |
| top_p              | 0.95  |
| top_k              | 20    |
| min_p              | 0.0   |
| presence_penalty   | 0.0   |
| repetition_penalty | 1.0   |
