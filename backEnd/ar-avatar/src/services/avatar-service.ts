import { Avatar, AvatarDoc, AvatarAttrs, AvatarStatus, AvatarModelType, AvatarModelFormat } from '../models/avatar';
import { characterDescriptionGenerator, CharacterDescription } from './character-description-generator';
import { modelGenerator, GeneratedModel } from './model-generator';
import { storageService } from './storage-service';
import * as path from 'path';

export class AvatarService {
  /**
   * Generate avatar for an agent
   */
  async generateAvatar(agentId: string, agentProfile: any): Promise<AvatarDoc> {
    console.log(`[AvatarService] Generating avatar for agent ${agentId}`);

    // Check if avatar already exists
    const existing = await Avatar.findByAgentId(agentId);
    if (existing && existing.status === AvatarStatus.Ready) {
      console.log(`[AvatarService] Avatar already exists for agent ${agentId}`);
      return existing;
    }

    // Create or update avatar record
    const avatar = existing || Avatar.build({
      agentId,
      ownerUserId: agentProfile.ownerUserId || agentProfile.ownerId,
      status: AvatarStatus.Pending,
    });

    avatar.status = AvatarStatus.Generating;
    avatar.generationStartedAt = new Date();
    await avatar.save();

    try {
      // Step 1: Generate character description
      const description = await characterDescriptionGenerator.generateDescription(agentProfile);
      avatar.characterDescription = description as any;

      // Step 2: Generate model
      const generatedModel = await modelGenerator.generateModel(agentProfile);

      // Step 3: Download and store model (with progress tracking)
      // IMPORTANT: This is the rigged model URL which has: Preview → Rig → Retexture (textures)
      // For Option A pattern: This is the BASE CHARACTER (mesh + textures + skeleton)
      // See: docs/MESHY_COLOR_AND_ANIMATION_FLOW.md and docs/MESHY_TEXTURE_FIX.md
      console.log(`[AvatarService] Downloading BASE CHARACTER from: ${generatedModel.modelUrl}`);
      console.log(`[AvatarService] This model should have textures EMBEDDED in GLB from Retexture API (colors)`);
      console.log(`[AvatarService] Flow: Mesh → Rig → Texture (correct order)`);
      console.log(`[AvatarService] This model should have rigging (skeleton for animations)`);
      console.log(`[AvatarService] Animation clips (${generatedModel.animationUrls?.length || 0}) will be loaded separately`);

      const uploadResult = await storageService.downloadAndStore(
        generatedModel.modelUrl,
        `${agentId}_${Date.now()}.${generatedModel.format}`,
        (bytesDownloaded, totalBytes) => {
          if (totalBytes) {
            const progress = Math.round((bytesDownloaded / totalBytes) * 100);
            const mbDownloaded = (bytesDownloaded / 1024 / 1024).toFixed(2);
            const mbTotal = (totalBytes / 1024 / 1024).toFixed(2);
            console.log(`[AvatarService] Download progress: ${progress}% (${mbDownloaded} MB / ${mbTotal} MB)`);
          } else {
            const mbDownloaded = (bytesDownloaded / 1024 / 1024).toFixed(2);
            console.log(`[AvatarService] Downloaded: ${mbDownloaded} MB`);
          }
        }
      );

      // Step 3a: Extract textures from GLB for React Native compatibility
      // React Native doesn't support creating Blob from ArrayBuffer (used in embedded GLB textures)
      // Solution: Extract textures server-side, remove from GLB, and serve as separate image URLs
      console.log(`[AvatarService] Extracting textures from GLB for React Native compatibility...`);
      let extractedTextureUrls: string[] = [];
      let updatedModelUrl = uploadResult.url; // Default to original if extraction fails
      let binFileName: string | undefined = undefined; // Store .bin filename for GLTF format
      try {
        const { extractTexturesFromGLB } = await import('../utils/glb-texture-extractor');
        const fs = require('fs');
        const tempDir = require('os').tmpdir();
        // Use storageGateway from storageService (it has uploadBuffer method)
        const storageGateway = storageService.gateway;

        // Download the GLB to a temp file for processing
        const axios = require('axios');
        const glbResponse = await axios.get(uploadResult.url, { responseType: 'arraybuffer' });
        const tempGlbPath = require('path').join(tempDir, `temp_${Date.now()}.glb`);
        fs.writeFileSync(tempGlbPath, Buffer.from(glbResponse.data));

        console.log(`[AvatarService] 📦 Starting texture extraction from: ${tempGlbPath}`);
        console.log(`[AvatarService] 📦 File exists: ${fs.existsSync(tempGlbPath)}`);
        console.log(`[AvatarService] 📦 File size: ${fs.existsSync(tempGlbPath) ? fs.statSync(tempGlbPath).size : 0} bytes`);

        const extractionResult = await extractTexturesFromGLB(
          tempGlbPath, // Use local file path
          tempDir,
          storageGateway,
          'avatars'
        );

        console.log(`[AvatarService] 📦 Extraction result:`, {
          hasUpdatedModelPath: !!extractionResult.updatedModelPath,
          updatedModelPath: extractionResult.updatedModelPath,
          textureCount: extractionResult.textureUrls?.length || 0,
          binFileName: extractionResult.binFileName,
          extractionResultKeys: Object.keys(extractionResult)
        });

        extractedTextureUrls = extractionResult.textureUrls;

        console.log(`[AvatarService] 📊 Before GLTF upload check:`, {
          hasUpdatedModelPath: !!extractionResult.updatedModelPath,
          pathExists: extractionResult.updatedModelPath ? fs.existsSync(extractionResult.updatedModelPath) : false,
          pathEndsWithGltf: extractionResult.updatedModelPath?.endsWith('.gltf'),
          currentUpdatedModelUrl: updatedModelUrl
        });

        // Upload the converted GLTF file (with external textures, React Native compatible)
        if (extractionResult.updatedModelPath && fs.existsSync(extractionResult.updatedModelPath)) {
          // Use a predictable name for both files (better than temp names)
          const timestamp = Date.now();
          const modelBaseName = `${agentId}_${timestamp}`;
          const gltfFileName = `${modelBaseName}.gltf`;
          binFileName = `${modelBaseName}.bin`; // Predictable name - assign to outer scope

          // Read GLTF file to update the .bin filename reference
          const gltfContent = fs.readFileSync(extractionResult.updatedModelPath, 'utf-8');
          const gltfJson = JSON.parse(gltfContent);

          // Update the .bin filename in GLTF to use our predictable name
          if (gltfJson.buffers && gltfJson.buffers.length > 0) {
            const oldBinName = gltfJson.buffers[0].uri;
            console.log(`[AvatarService] 📦 GLTF originally references .bin file: ${oldBinName}`);

            // Update to use predictable name
            gltfJson.buffers[0].uri = binFileName;
            const updatedGltfContent = JSON.stringify(gltfJson, null, 2);
            fs.writeFileSync(extractionResult.updatedModelPath, updatedGltfContent, 'utf-8');
            console.log(`[AvatarService] 🔧 Updated GLTF to reference: ${binFileName}`);

            // Rename the actual .bin file to match if it has a different name
            const gltfDir = path.dirname(extractionResult.updatedModelPath);
            const oldBinPath = path.join(gltfDir, oldBinName || '');
            const newBinPath = path.join(gltfDir, binFileName);

            // Only rename if the old and new paths are different
            if (oldBinName && oldBinName !== binFileName && fs.existsSync(oldBinPath)) {
              // Check if we're trying to rename to the same file (shouldn't happen, but safety check)
              if (oldBinPath !== newBinPath) {
                // Remove new file if it exists
                if (fs.existsSync(newBinPath)) {
                  fs.unlinkSync(newBinPath);
                }
                // Rename the .bin file to match the GLTF reference
                fs.renameSync(oldBinPath, newBinPath);
                console.log(`[AvatarService] 🔧 Renamed .bin file from ${oldBinName} to ${binFileName}`);
                console.log(`[AvatarService] 🔧 Old path: ${oldBinPath}`);
                console.log(`[AvatarService] 🔧 New path: ${newBinPath}`);
              } else {
                console.log(`[AvatarService] ℹ️ .bin file already has correct name: ${binFileName}`);
              }
            } else if (!oldBinName) {
              // If GLTF doesn't reference a .bin file, check if standard .bin exists
              const standardBinPath = extractionResult.updatedModelPath.replace('.gltf', '.bin');
              if (fs.existsSync(standardBinPath)) {
                const renamedBinPath = path.join(gltfDir, binFileName);
                if (standardBinPath !== renamedBinPath) {
                  if (fs.existsSync(renamedBinPath)) {
                    fs.unlinkSync(renamedBinPath);
                  }
                  fs.renameSync(standardBinPath, renamedBinPath);
                  console.log(`[AvatarService] 🔧 Renamed standard .bin file to: ${binFileName}`);
                }
              }
            }
          }

          // Upload GLTF file
          const gltfBuffer = fs.readFileSync(extractionResult.updatedModelPath);
          console.log(`[AvatarService] 📤 Uploading GLTF file:`, {
            fileName: gltfFileName,
            bufferSize: gltfBuffer.length,
            contentType: 'model/gltf+json',
            binFileName
          });

          const gltfUpload = await storageService.uploadModel(
            gltfBuffer,
            gltfFileName,
            'model/gltf+json'
          );

          updatedModelUrl = gltfUpload.url || storageService.generateCDNUrl(gltfUpload.key);
          console.log(`[AvatarService] ✅ Uploaded GLTF model (React Native compatible): ${updatedModelUrl}`);
          console.log(`[AvatarService] 📦 GLTF key: ${gltfUpload.key}`);
          console.log(`[AvatarService] 📦 GLTF upload result:`, {
            url: gltfUpload.url,
            key: gltfUpload.key,
            container: gltfUpload.container,
            urlEndsWithGltf: updatedModelUrl.endsWith('.gltf'),
            urlIncludesQuery: updatedModelUrl.includes('?')
          });

          // Extract timestamp from GLTF upload key to ensure .bin file goes to same directory
          // Key format: avatars/{timestamp}/{fileName}
          const keyParts = gltfUpload.key.split('/');
          const timestampFromKey = keyParts.length >= 2 ? keyParts[1] : null;

          // Upload .bin file to the SAME directory with the name referenced in GLTF
          // The .bin file was renamed earlier to match binFileName, so we must use that path
          const binPath = path.join(path.dirname(extractionResult.updatedModelPath), binFileName);
          if (fs.existsSync(binPath)) {
            const binBuffer = fs.readFileSync(binPath);

            // Use storage gateway directly to upload to same directory with correct name
            const storageGateway = storageService.gateway;
            const binKey = timestampFromKey
              ? `avatars/${timestampFromKey}/${binFileName}`
              : `avatars/${Date.now()}/${binFileName}`;

            const binUrl = await storageGateway.uploadBuffer(
              'avatars',
              binKey,
              binBuffer,
              'application/octet-stream'
            );

            console.log(`[AvatarService] ✅ Uploaded GLTF binary: ${binUrl}`);
            console.log(`[AvatarService] 📦 Binary key: ${binKey}`);
            console.log(`[AvatarService] 📦 Binary filename matches GLTF reference: ${binFileName}`);
            console.log(`[AvatarService] 📦 GLTF and .bin files are in the same directory: avatars/${timestampFromKey}/`);
          } else {
            console.warn(`[AvatarService] ⚠️ No .bin file found at ${binPath} - GLTF may not load correctly`);
          }
        }

        // Cleanup temp files
        try {
          fs.unlinkSync(tempGlbPath);
          if (extractionResult.updatedModelPath && fs.existsSync(extractionResult.updatedModelPath)) {
            fs.unlinkSync(extractionResult.updatedModelPath);
          }
          const binPath = tempGlbPath.replace('.glb', '.bin');
          if (fs.existsSync(binPath)) {
            fs.unlinkSync(binPath);
          }
        } catch (e) {
          console.warn(`[AvatarService] Failed to cleanup temp files:`, e);
        }

        console.log(`[AvatarService] ✅ Extracted ${extractedTextureUrls.length} textures from GLB`);
        console.log(`[AvatarService] Texture URLs:`, extractedTextureUrls);
        console.log(`[AvatarService] ✅ Texture extraction and GLTF conversion completed successfully`);
      } catch (extractError: any) {
        console.error(`[AvatarService] ❌ CRITICAL: Failed to extract textures and convert to GLTF:`, extractError);
        console.error(`[AvatarService] ❌ Error details:`, extractError?.stack || extractError?.message);
        console.error(`[AvatarService] ❌ This will cause the model to FAIL in React Native`);
        console.error(`[AvatarService] ❌ The model will remain as GLB format with embedded textures`);
        console.error(`[AvatarService] ❌ React Native cannot load GLB files with embedded textures`);
        // Continue without textures - but this will cause client-side loading failures
        // The modelUrl will remain as the original GLB, which will fail in React Native
        // We should probably throw here instead of continuing, but for now we'll log the error
      }

      // Step 3b: Download and store animation GLBs (if available)
      const uploadedAnimationUrls: string[] = [];
      if (generatedModel.animationUrls && generatedModel.animationUrls.length > 0) {
        console.log(`[AvatarService] Uploading ${generatedModel.animationUrls.length} animation GLBs to Azure...`);
        for (let i = 0; i < generatedModel.animationUrls.length; i++) {
          const animUrl = generatedModel.animationUrls[i];
          try {
            const animUploadResult = await storageService.downloadAndStore(
              animUrl,
              `${agentId}_animation_${i}_${Date.now()}.${generatedModel.format}`,
              (bytesDownloaded, totalBytes) => {
                if (totalBytes) {
                  const progress = Math.round((bytesDownloaded / totalBytes) * 100);
                  console.log(`[AvatarService] Animation ${i + 1}/${generatedModel.animationUrls!.length} upload: ${progress}%`);
                }
              }
            );
            uploadedAnimationUrls.push(animUploadResult.url || storageService.generateCDNUrl(animUploadResult.key));
            console.log(`[AvatarService] ✅ Uploaded animation ${i + 1}/${generatedModel.animationUrls.length}`);
          } catch (error: any) {
            console.warn(`[AvatarService] Failed to upload animation ${i + 1}: ${error.message}`);
            // Continue with other animations
          }
        }
        console.log(`[AvatarService] ✅ Uploaded ${uploadedAnimationUrls.length}/${generatedModel.animationUrls.length} animations to Azure`);
      }

      // Step 4: Update avatar record
      // Use the GLTF model URL (with external textures, React Native compatible) if extraction succeeded, otherwise use original
      avatar.modelUrl = updatedModelUrl || uploadResult.url || storageService.generateCDNUrl(uploadResult.key);
      avatar.textureUrls = extractedTextureUrls; // Store extracted texture URLs for React Native
      avatar.animationUrls = uploadedAnimationUrls.length > 0 ? uploadedAnimationUrls : [];

      // Update format to GLTF if conversion succeeded (React Native compatible)
      // Check both updatedModelUrl and final modelUrl (in case updatedModelUrl wasn't set but modelUrl is GLTF)
      const isGltfFromUpdated = updatedModelUrl && updatedModelUrl.split('?')[0].endsWith('.gltf');
      const isGltfFromFinal = avatar.modelUrl && avatar.modelUrl.split('?')[0].endsWith('.gltf');
      const isGltf = isGltfFromUpdated || isGltfFromFinal;
      const originalFormat = avatar.format;
      avatar.format = isGltf ? AvatarModelFormat.GLTF : generatedModel.format;

      console.log(`[AvatarService] 📊 Format check:`, {
        updatedModelUrl,
        isGltf,
        originalFormat,
        newFormat: avatar.format,
        generatedModelFormat: generatedModel.format,
        modelUrlEndsWithGltf: avatar.modelUrl?.endsWith('.gltf'),
        binFileName,
        willStoreBinFileName: isGltf && binFileName
      });

      // Store the .bin filename for GLTF format (needed for client-side loading)
      if (isGltf && binFileName) {
        avatar.binFileName = binFileName;
        console.log(`[AvatarService] 📦 Stored .bin filename: ${binFileName}`);
      } else {
        console.warn(`[AvatarService] ⚠️ NOT storing binFileName:`, {
          isGltf,
          binFileName,
          reason: !isGltf ? 'not GLTF format' : !binFileName ? 'binFileName is undefined' : 'unknown'
        });
      }

      // Log final model format for debugging
      console.log(`[AvatarService] 📦 Final model URL: ${avatar.modelUrl}`);
      console.log(`[AvatarService] 📦 Model format: ${avatar.format}`);
      console.log(`[AvatarService] 📦 Is GLTF (RN-compatible): ${isGltf ? 'YES ✅' : 'NO ❌'}`);
      console.log(`[AvatarService] 📦 binFileName in avatar: ${avatar.binFileName || 'NOT SET'}`);
      if (!isGltf) {
        console.error(`[AvatarService] ❌ WARNING: Model is NOT in GLTF format - will FAIL in React Native`);
        console.error(`[AvatarService] ❌ Texture extraction/conversion may have failed - check logs above`);
      }
      avatar.modelType = this.determineModelType(description);
      avatar.provider = generatedModel.modelId.split('_')[0]; // Extract provider from modelId
      avatar.providerModelId = generatedModel.modelId;
      avatar.polygonCount = generatedModel.metadata.polygonCount;
      avatar.textureResolution = generatedModel.metadata.textureResolution;
      avatar.boneCount = generatedModel.metadata.boneCount;
      avatar.animationCount = generatedModel.metadata.animationCount;
      avatar.status = AvatarStatus.Ready;
      avatar.generationCompletedAt = new Date();
      avatar.lipSync = {
        enabled: true,
        method: 'viseme',
      };
      avatar.animations = {
        idle: 'idle',
        talking: 'talking',
        gestures: ['wave', 'nod', 'point'],
      };

      await avatar.save();

      console.log(`[AvatarService] Avatar generated successfully for agent ${agentId}`);
      return avatar;
    } catch (error: any) {
      console.error(`[AvatarService] Error generating avatar for agent ${agentId}:`, error);

      avatar.status = AvatarStatus.Failed;
      avatar.generationError = error.message || 'Unknown error';
      await avatar.save();

      throw error;
    }
  }

  /**
   * Get avatar for an agent
   */
  async getAvatar(agentId: string): Promise<AvatarDoc | null> {
    return Avatar.findByAgentId(agentId);
  }

  /**
   * Get avatar generation status with detailed progress
   */
  async getAvatarStatus(agentId: string): Promise<{
    status: AvatarStatus;
    progress?: number;
    error?: string;
    modelUrl?: string;
    textureUrls?: string[]; // Separate texture image URLs (extracted from GLB for React Native)
    animationUrls?: string[]; // Separate animation GLB URLs (for Meshy models)
    format?: string;
    modelType?: string;
    estimatedTimeRemaining?: number; // seconds
    binFileName?: string; // For GLTF format: the .bin filename referenced in the GLTF JSON
    binUrl?: string; // Explicit signed URL for the .bin file (needed for private containers)
  }> {
    const avatar = await Avatar.findByAgentId(agentId);
    if (!avatar) {
      return { status: AvatarStatus.Pending };
    }

    const progress = this.calculateProgress(avatar);
    let estimatedTimeRemaining: number | undefined;

    if (avatar.status === AvatarStatus.Generating && avatar.generationStartedAt) {
      const elapsed = Date.now() - avatar.generationStartedAt.getTime();
      const estimatedTotal = 30000; // 30 seconds estimated
      estimatedTimeRemaining = Math.max(0, Math.round((estimatedTotal - elapsed) / 1000));
    }

    // Generate signed URL for .bin file if it exists (crucial for GLTF in private storage)
    let binUrl: string | undefined;
    if (avatar.binFileName && avatar.modelUrl) {
      try {
        const storageGateway = storageService.gateway;

        // Clean URL (remove query string)
        const cleanUrl = avatar.modelUrl.split('?')[0];

        // Parse container and blob path
        let containerName = 'avatars'; // Default
        let blobPath = '';

        if (storageGateway.parseBlobUrl) {
          const parsed = storageGateway.parseBlobUrl(cleanUrl);
          if (parsed) {
            containerName = parsed.container;
            // Extract directory from blobName
            const lastSlashIndex = parsed.blobName.lastIndexOf('/');
            const dir = lastSlashIndex >= 0 ? parsed.blobName.substring(0, lastSlashIndex + 1) : '';
            blobPath = `${dir}${avatar.binFileName}`;
          }
        } else {
          // Fallback parsing if gateway doesn't support it (assume Azure/S3 structure)
          try {
            const urlObj = new URL(cleanUrl);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2) {
              containerName = pathParts[0];
              const blobName = pathParts.slice(1).join('/');
              const lastSlashIndex = blobName.lastIndexOf('/');
              const dir = lastSlashIndex >= 0 ? blobName.substring(0, lastSlashIndex + 1) : '';
              blobPath = `${dir}${avatar.binFileName}`;
            }
          } catch (e) {
            // Invalid URL, skip binUrl generation
          }
        }

        // If we identified the blob path, generate a signed URL
        if (blobPath) {
          // Use 24 hours expiration for the bin file
          binUrl = await storageGateway.generateDownloadUrl(containerName, blobPath, 86400);
        }
      } catch (e) {
        console.warn(`[AvatarService] Failed to generate signed URL for .bin file:`, e);
        // Continue without binUrl (client fallback might fail but we don't want to crash)
      }
    }

    return {
      status: avatar.status,
      error: avatar.generationError,
      progress,
      modelUrl: avatar.modelUrl,
      textureUrls: avatar.textureUrls || [], // Extracted texture URLs for React Native compatibility
      animationUrls: avatar.animationUrls || [],
      format: avatar.format,
      modelType: avatar.modelType,
      estimatedTimeRemaining,
      binFileName: avatar.binFileName, // For GLTF format: the .bin filename referenced in the GLTF JSON
      binUrl, // Explicit signed URL for the .bin file
    };
  }

  private determineModelType(description: CharacterDescription): AvatarModelType {
    if (description.style === 'anime' || description.style === 'chibi') {
      return AvatarModelType.Anime;
    }
    return AvatarModelType.ThreeD;
  }

  private calculateProgress(avatar: any): number {
    if (avatar.status === AvatarStatus.Ready) return 100;
    if (avatar.status === AvatarStatus.Failed) return 0;
    if (avatar.status === AvatarStatus.Generating) {
      // Estimate progress based on time elapsed
      if (avatar.generationStartedAt) {
        const elapsed = Date.now() - avatar.generationStartedAt.getTime();
        const estimatedTotal = 30000; // 30 seconds
        return Math.min(90, Math.floor((elapsed / estimatedTotal) * 100));
      }
      return 50; // Default progress
    }
    return 0;
  }
}

export const avatarService = new AvatarService();

