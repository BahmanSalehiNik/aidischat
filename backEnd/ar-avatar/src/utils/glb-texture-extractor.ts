/**
 * GLB Texture Extractor
 * 
 * Extracts embedded textures from GLB files and converts them to external texture files.
 * This is necessary for React Native compatibility, as React Native doesn't support
 * creating Blob objects from ArrayBuffer (which GLB embedded textures use).
 * 
 * Uses gltf-transform to:
 * 1. Read GLB file
 * 2. Extract embedded textures
 * 3. Save textures as separate PNG/JPG files
 * 4. Update GLB to reference external textures (or convert to GLTF)
 * 
 * @see docs/REACT_NATIVE_TEXTURE_FIX.md
 */

import { NodeIO, Document, Texture } from '@gltf-transform/core';
import { dedup, textureCompress } from '@gltf-transform/functions';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export interface ExtractedTextures {
  textureUrls: string[];
  updatedModelPath?: string; // Path to updated GLB/GLTF with external texture references
  binFileName?: string; // The actual .bin filename referenced in the GLTF (for proper upload)
}

/**
 * Extract textures from a GLB file
 * @param glbUrl URL or local path to GLB file
 * @param outputDir Directory to save extracted textures
 * @param storageService Service to upload textures to storage
 * @returns Array of texture URLs
 */
export async function extractTexturesFromGLB(
  glbUrl: string,
  outputDir: string,
  storageGateway: {
    uploadBuffer: (containerName: string, blobName: string, buffer: Buffer, contentType: string) => Promise<string>;
  },
  containerName: string = 'avatars'
): Promise<ExtractedTextures> {
  console.log(`[GLBTextureExtractor] Starting texture extraction from: ${glbUrl}`);
  
  // Download GLB file if it's a URL
  let glbPath: string;
  let shouldCleanup = false;
  
  if (glbUrl.startsWith('http://') || glbUrl.startsWith('https://')) {
    // Download GLB to temporary file
    const response = await axios.get(glbUrl, { responseType: 'arraybuffer' });
    glbPath = path.join(outputDir, `temp_${Date.now()}.glb`);
    fs.mkdirSync(path.dirname(glbPath), { recursive: true });
    fs.writeFileSync(glbPath, Buffer.from(response.data));
    shouldCleanup = true;
    console.log(`[GLBTextureExtractor] Downloaded GLB to: ${glbPath}`);
  } else {
    glbPath = glbUrl;
  }
  
  try {
    // Initialize gltf-transform
    const io = new NodeIO();
    
    // Read GLB file
    console.log(`[GLBTextureExtractor] Reading GLB file...`);
    const document = await io.read(glbPath);
    
    // Get all textures
    const textures = document.getRoot().listTextures();
    console.log(`[GLBTextureExtractor] Found ${textures.length} textures in GLB`);
    
    if (textures.length === 0) {
      console.warn(`[GLBTextureExtractor] No textures found in GLB file`);
      return { textureUrls: [] };
    }
    
    const textureUrls: string[] = [];
    const timestamp = Date.now();
    
    // Extract each texture
    for (let i = 0; i < textures.length; i++) {
      const texture = textures[i];
      const image = texture.getImage();
      
      if (!image) {
        console.warn(`[GLBTextureExtractor] Texture ${i} has no image data, skipping`);
        continue;
      }
      
      // Determine MIME type
      const mimeType = texture.getMimeType() || 'image/png';
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      
      // Save texture to buffer
      const textureBuffer = Buffer.from(image);
      
      // Upload to storage
      const textureKey = `textures/${timestamp}/texture_${i}.${extension}`;
      const textureUrl = await storageGateway.uploadBuffer(
        containerName,
        textureKey,
        textureBuffer,
        mimeType
      );
      
      textureUrls.push(textureUrl);
      console.log(`[GLBTextureExtractor] ✅ Extracted and uploaded texture ${i}: ${textureUrl}`);
    }
    
    // CRITICAL: Convert GLB to GLTF format with external textures
    // GLB format embeds textures in bufferViews, which causes React Native loading errors
    // React Native doesn't support creating Blob from ArrayBuffer (used for embedded textures)
    // Solution: Convert to GLTF format which uses external texture files (RN-safe)
    console.log(`[GLBTextureExtractor] Converting GLB to GLTF format with external textures (React Native compatible)...`);
    
    // Update texture URIs to point to external files
    // The textures are already extracted and uploaded, so we just need to update the references
    textures.forEach((texture, i) => {
      const mimeType = texture.getMimeType() || 'image/png';
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      // Set URI to external texture file (relative path - client will use textureUrls)
      // Note: The actual textures are uploaded separately, but we set URIs for GLTF structure
      texture.setURI(`texture_${i}.${extension}`);
      // Clear embedded image data (this makes it external)
      // Note: gltf-transform will handle this when writing as GLTF
    });
    
    // Write as GLTF (separate .gltf, .bin, and texture files)
    // This automatically makes textures external (RN-safe)
    // IMPORTANT: The .bin file will be created in the same directory as the .gltf file
    const gltfPath = glbPath.replace('.glb', '.gltf');
    await io.write(gltfPath, document);
    
    // Verify .bin file was created
    const binPath = gltfPath.replace('.gltf', '.bin');
    const binExists = fs.existsSync(binPath);
    console.log(`[GLBTextureExtractor] ✅ Converted GLB to GLTF: ${gltfPath}`);
    console.log(`[GLBTextureExtractor] ✅ Binary file ${binExists ? 'created' : 'NOT found'}: ${binPath}`);
    
    // Read the GLTF JSON to see what .bin filename it references
    // gltf-transform may use temp names, so we need to update it
    const gltfContent = fs.readFileSync(gltfPath, 'utf-8');
    const gltfJson = JSON.parse(gltfContent);
    
    // Extract the actual .bin filename from the GLTF
    let actualBinFileName: string | null = null;
    if (gltfJson.buffers && gltfJson.buffers.length > 0 && gltfJson.buffers[0].uri) {
      actualBinFileName = gltfJson.buffers[0].uri;
      console.log(`[GLBTextureExtractor] 📦 GLTF references .bin file: ${actualBinFileName}`);
      
      // Get the actual .bin filename from the file system
      if (actualBinFileName) {
        const actualBinPath = path.join(path.dirname(gltfPath), actualBinFileName);
        if (fs.existsSync(actualBinPath)) {
          console.log(`[GLBTextureExtractor] ✅ Found .bin file at: ${actualBinPath}`);
        } else {
          console.warn(`[GLBTextureExtractor] ⚠️ .bin file not found at expected path: ${actualBinPath}`);
          // Try the standard naming convention
          if (fs.existsSync(binPath)) {
            console.log(`[GLBTextureExtractor] ✅ Found .bin file at standard path: ${binPath}`);
            // Update GLTF to reference the standard name
            const standardBinName = path.basename(binPath);
            gltfJson.buffers[0].uri = standardBinName;
            fs.writeFileSync(gltfPath, JSON.stringify(gltfJson, null, 2), 'utf-8');
            console.log(`[GLBTextureExtractor] 🔧 Updated GLTF to reference: ${standardBinName}`);
            actualBinFileName = standardBinName; // Update for return value
          }
        }
      }
    }
    
    console.log(`[GLBTextureExtractor] GLTF format uses external textures (React Native compatible)`);
    console.log(`[GLBTextureExtractor] ⚠️ IMPORTANT: .gltf and .bin files must be uploaded to the same directory`);
    
    // Return GLTF path and the actual .bin filename
    
    console.log(`[GLBTextureExtractor] ✅ Extracted ${textureUrls.length} textures`);
    console.log(`[GLBTextureExtractor] Texture URLs:`, textureUrls);
    console.log(`[GLBTextureExtractor] ✅ Model converted to GLTF format (React Native compatible)`);
    
    // Return the actual .bin filename from the GLTF JSON
    const finalBinFileName = actualBinFileName || (binExists ? path.basename(binPath) : 'model.bin');
    
    return {
      textureUrls,
      updatedModelPath: gltfPath, // GLTF path (external textures, RN-safe)
      binFileName: finalBinFileName, // The .bin filename referenced in GLTF
    };
  } catch (error: any) {
    console.error(`[GLBTextureExtractor] ❌ Error extracting textures:`, error);
    throw new Error(`Failed to extract textures from GLB: ${error.message}`);
  } finally {
    // Cleanup temporary file if we downloaded it
    if (shouldCleanup && fs.existsSync(glbPath)) {
      try {
        fs.unlinkSync(glbPath);
        console.log(`[GLBTextureExtractor] Cleaned up temporary file: ${glbPath}`);
      } catch (e) {
        console.warn(`[GLBTextureExtractor] Failed to cleanup temporary file:`, e);
      }
    }
  }
}

/**
 * Extract textures from a GLB file that's already downloaded locally
 * @param glbPath Local path to GLB file
 * @param outputDir Directory to save extracted textures
 * @param storageService Service to upload textures to storage
 * @returns Array of texture URLs
 */
export async function extractTexturesFromLocalGLB(
  glbPath: string,
  storageGateway: {
    uploadBuffer: (containerName: string, blobName: string, buffer: Buffer, contentType: string) => Promise<string>;
  },
  containerName: string = 'avatars'
): Promise<ExtractedTextures> {
  return extractTexturesFromGLB(glbPath, path.dirname(glbPath), storageGateway, containerName);
}

