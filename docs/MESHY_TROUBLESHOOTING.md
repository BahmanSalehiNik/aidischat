# Meshy.ai API Troubleshooting Guide

## Common Errors and Solutions

### Error: "Invalid parameter" or "Parameter not supported"

**Cause**: Your API plan may not support all parameters, or parameter names/values are incorrect.

**Solution**:
1. **Check which parameters are supported**:
   - Required: `prompt`, `mode`, `art_style`, `negative_prompt`, `should_remesh`
   - Optional (may not be supported): `target_polycount`, `topology`, `pose_mode`, `symmetry_mode`

2. **Try minimal request first**:
   ```json
   {
     "prompt": "a humanoid character",
     "mode": "preview",
     "art_style": "sculpture",
     "negative_prompt": "blurry, low quality",
     "should_remesh": true
   }
   ```

3. **Add parameters one by one**:
   - First add `target_polycount: 10000`
   - Then add `topology: "triangle"`
   - Then add `pose_mode: "t-pose"`

4. **If parameters fail**: Use remesh API after generation for lightweight optimization

### Error: "Invalid response from Meshy API - no result field"

**Cause**: API response structure is different than expected, or request failed.

**Solution**:
1. **Check error response**:
   ```typescript
   if (response.data.error) {
     console.error('Meshy error:', response.data.error);
   }
   ```

2. **Check response structure**:
   ```typescript
   console.log('Full response:', JSON.stringify(response.data, null, 2));
   ```

3. **Verify API key** is valid and has correct permissions

4. **Check API plan limits** - some features may require higher tier

### Error: "Meshy API error (400/401/403)"

**HTTP 400 (Bad Request)**:
- Invalid parameter values
- Missing required parameters
- Parameter out of valid range (e.g., `target_polycount` must be 100-300,000)

**HTTP 401 (Unauthorized)**:
- Invalid or missing API key
- API key expired

**HTTP 403 (Forbidden)**:
- API key doesn't have permission for this endpoint
- Rate limit exceeded
- Account quota exceeded

**Solution**:
1. Check API key in environment variables
2. Verify API key is active in Meshy dashboard
3. Check account quota/credits
4. Review error message in response body

### Error: "Rigging failed" or "Model not humanoid"

**Cause**: Model doesn't meet rigging requirements.

**Solution**:
1. **Ensure model is humanoid** with clear limbs/body structure
2. **Check model is in T-pose or A-pose** (add to prompt: "in T-pose")
3. **Verify model is textured** (not just geometry)
4. **Check model URL is publicly accessible**
5. **Try different `rig_preset`**: "STANDARD_HUMANOID" or let it auto-detect

### Error: "Animation failed" or "Invalid action_id"

**Cause**: Animation ID doesn't exist or isn't available for this character type.

**Solution**:
1. **Check Animation Library**: https://docs.meshy.ai/api/animation-library
2. **Verify action_id exists** in current library version
3. **Try common IDs first**: 0 (Idle), 1 (Walking_Woman), 25 (Agree_Gesture)
4. **Ensure rigging completed successfully** before adding animations

### Error: "Task timed out"

**Cause**: Generation/rigging/animation took too long.

**Solution**:
1. **Increase timeout** in polling function
2. **Check task status** manually via API
3. **Verify task is actually processing** (not stuck)
4. **Try simpler model** (lower polycount, simpler geometry)

### Error: "Texture refinement failed"

**Cause**: Refine stage failed or preview task ID invalid.

**Solution**:
1. **Verify preview task completed** successfully
2. **Check preview_task_id** is correct
3. **Try without refine** (use preview model directly)
4. **Check if refine is supported** in your API plan

### Error: "Remesh failed"

**Cause**: Remesh API call failed or model URL invalid.

**Solution**:
1. **Verify model URL is accessible**
2. **Check remesh parameters** are valid
3. **Try without remesh** (model may already be lightweight)
4. **Use remesh only if needed** (optional step)

## Debugging Steps

### 1. Enable Detailed Logging

The code already includes detailed error logging. Check backend logs for:
```
[MeshyProvider] Meshy API error response: { status, statusText, data }
```

### 2. Test API Calls Manually

Use curl or Postman to test Meshy API directly:

```bash
curl -X POST https://api.meshy.ai/v2/text-to-3d \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a humanoid character",
    "mode": "preview",
    "art_style": "sculpture",
    "should_remesh": true
  }'
```

### 3. Check Response Structure

If you get unexpected responses, log the full structure:
```typescript
console.log('Response:', JSON.stringify(response.data, null, 2));
```

### 4. Verify API Plan Features

Some features may require specific API plans:
- Check Meshy dashboard for your plan limits
- Verify which endpoints are available
- Check parameter support for your plan

## Parameter Support by API Plan

**Free/Basic Plans**:
- ✅ Preview mode
- ✅ Refine mode
- ❌ May not support `target_polycount`, `topology`, `pose_mode` in preview
- ✅ Remesh API (may have limits)
- ✅ Rigging API
- ✅ Animation API

**Pro/Enterprise Plans**:
- ✅ All preview parameters
- ✅ All refine parameters
- ✅ Remesh API
- ✅ Full rigging features
- ✅ Full animation library access

## Fallback Strategies

### If Preview Parameters Fail

1. **Generate without lightweight parameters**
2. **Use remesh API after generation** to optimize
3. **Or skip remesh** if model is already acceptable

### If Refine Fails

1. **Use preview model directly** (untextured)
2. **Or retry refine** with different parameters
3. **Check if refine is needed** (preview may be sufficient for testing)

### If Rigging Fails

1. **Check model pose** - ensure T-pose or A-pose
2. **Try different `rig_preset`**
3. **Verify model is humanoid** with clear structure
4. **Use model without rigging** (no animations, but model still works)

### If Animation Fails

1. **Check action_id** is valid in animation library
2. **Try different action_id** values
3. **Use basic animations** from rigging response (if available)
4. **Skip animations** - model will work without them

## Getting Help

1. **Check Meshy API Documentation**: https://docs.meshy.ai/
2. **Review error messages** in backend logs
3. **Test API calls manually** to isolate issues
4. **Check Meshy dashboard** for account status/quota
5. **Contact Meshy support** if issues persist

## Common Parameter Errors

### "target_polycount must be between 100 and 300000"
- **Fix**: Use value in valid range (e.g., 10000 for mobile)

### "Invalid topology value"
- **Fix**: Use "triangle" or "quad" (not "tri" or other values)

### "Invalid pose_mode value"
- **Fix**: Use "t-pose", "a-pose", or "" (empty string)

### "should_remesh must be boolean"
- **Fix**: Use `true` or `false` (not string "true")

### "art_style not supported"
- **Fix**: Check available art styles for your plan (usually "realistic" or "sculpture")
