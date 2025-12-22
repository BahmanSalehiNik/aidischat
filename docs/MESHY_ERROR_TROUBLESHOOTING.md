# Meshy.ai Error Troubleshooting Guide

## Common Errors and Solutions

### Error: "Invalid response from Meshy API"

**Possible Causes:**
1. API key is invalid or expired
2. Request parameters are not supported in the current mode
3. API endpoint changed
4. Network/connectivity issues

**Solutions:**
1. **Check API Key:**
   ```bash
   # Verify MESHY_API_KEY is set
   echo $MESHY_API_KEY
   ```

2. **Check Parameter Support:**
   - Preview mode supports: `prompt`, `negative_prompt`, `art_style`, `should_remesh`, `ai_model`
   - Preview mode may NOT support: `target_polycount`, `topology`, `pose_mode`, `symmetry_mode`
   - These parameters are typically used in refine stage or remesh API

3. **Check API Response:**
   - Look for `error` field in response
   - Check response status code
   - Review full response structure

### Error: "Meshy API error (400/401/403)"

**400 Bad Request:**
- Invalid parameters
- Unsupported parameter combination
- Missing required fields

**401 Unauthorized:**
- Invalid or missing API key
- API key expired
- Wrong authentication format

**403 Forbidden:**
- API key doesn't have required permissions
- Rate limit exceeded
- Account limitations

**Solutions:**
1. Verify API key is correct and active
2. Check parameter names match Meshy docs exactly
3. Remove unsupported parameters for the mode you're using
4. Check your Meshy account plan/limits

### Error: "target_polycount not supported"

**Cause:** `target_polycount` may not be supported in preview mode.

**Solution:**
- Remove `target_polycount` from preview request
- Use remesh API after refine to set polycount
- Or set it in refine stage (if supported)

### Error: "pose_mode not supported"

**Cause:** `pose_mode` may not be supported in preview mode.

**Solution:**
- Remove `pose_mode` from preview request
- Add T-pose requirement to prompt text instead
- Or use remesh API with pose settings

### Error: "Invalid response structure"

**Cause:** Meshy API response format may have changed or error occurred.

**Solution:**
1. Check actual response:
   ```typescript
   console.error('Meshy response:', JSON.stringify(response.data, null, 2));
   ```

2. Verify response structure:
   - Preview: `{ "result": "task_id" }`
   - Polling: `{ "status": "SUCCEEDED", "model_urls": { "glb": "..." } }`

3. Check for error field:
   ```typescript
   if (response.data.error) {
     throw new Error(response.data.error.message);
   }
   ```

## Parameter Support by Mode

### Preview Mode (v2/text-to-3d)
**Supported:**
- ✅ `prompt` (required)
- ✅ `mode: "preview"` (required)
- ✅ `negative_prompt` (optional)
- ✅ `art_style` (optional)
- ✅ `should_remesh` (optional)
- ✅ `ai_model` (optional)

**May NOT be supported:**
- ❌ `target_polycount` (use remesh API instead)
- ❌ `topology` (use remesh API instead)
- ❌ `pose_mode` (add to prompt text instead)
- ❌ `symmetry_mode` (may not be supported)

### Refine Mode (v2/text-to-3d)
**Supported:**
- ✅ `mode: "refine"` (required)
- ✅ `preview_task_id` (required)
- ✅ `enable_pbr` (optional)
- ✅ `texture_prompt` (optional)
- ✅ `texture_image_url` (optional)

**May NOT be supported:**
- ❌ `target_polycount` (use remesh API instead)
- ❌ `topology` (use remesh API instead)

### Remesh API (openapi/v1/remesh)
**Supported:**
- ✅ `model_url` (required)
- ✅ `target_formats` (optional)
- ✅ `topology` (optional)
- ✅ `target_polycount` (optional)
- ✅ `resize_height` (optional)
- ✅ `origin_at` (optional)

## Debugging Steps

1. **Enable Detailed Logging:**
   ```typescript
   console.log('Request body:', JSON.stringify(requestBody, null, 2));
   console.log('Response:', JSON.stringify(response.data, null, 2));
   ```

2. **Check API Documentation:**
   - Verify parameter names match exactly
   - Check which parameters work in which mode
   - Review recent API changes

3. **Test with Minimal Request:**
   ```typescript
   // Start with just required parameters
   {
     prompt: "a humanoid character",
     mode: "preview"
   }
   ```

4. **Gradually Add Parameters:**
   - Add one parameter at a time
   - Test after each addition
   - Identify which parameter causes the error

## Common Fixes

### Fix 1: Remove Unsupported Parameters from Preview
```typescript
// Before (may cause error)
{
  prompt: "...",
  mode: "preview",
  target_polycount: 10000,  // ❌ May not be supported
  pose_mode: "t-pose",       // ❌ May not be supported
}

// After (should work)
{
  prompt: "...",
  mode: "preview",
  should_remesh: true,      // ✅ Supported
}
```

### Fix 2: Use Remesh API for Polycount
```typescript
// After refine, use remesh to set polycount
{
  model_url: refinedModelUrl,
  target_polycount: 10000,  // ✅ Supported in remesh
  topology: "triangle",    // ✅ Supported in remesh
}
```

### Fix 3: Add T-pose to Prompt Instead
```typescript
// Instead of pose_mode parameter
const prompt = "a humanoid character in T-pose, ...";
```

## Getting Help

1. **Check Meshy API Docs:**
   - https://docs.meshy.ai/api-reference/text-to-3d
   - https://docs.meshy.ai/api/remesh

2. **Check Error Response:**
   - Look for `error.message` in response
   - Check status codes
   - Review full error object

3. **Test with Meshy UI:**
   - Try same parameters in Meshy web UI
   - See if it works there
   - Compare request/response

4. **Contact Meshy Support:**
   - If error persists
   - Include full error message
   - Include request parameters (without API key)
