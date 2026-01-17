using System.Text;
using UnityEngine;

namespace AIChatAR.AR
{
    /// <summary>
    /// Utility for dumping blendshape names from imported GLB/glTF meshes.
    /// Helps identify what viseme/emotion blendshapes a Meshy model actually contains.
    /// </summary>
    public static class BlendshapeDebugUtil
    {
        public static void DumpAllBlendshapes(GameObject root, string context, bool includeZeroBlendshapeMeshes = false)
        {
            if (root == null)
            {
                Debug.LogWarning($"🧩 [BlendshapeDebug] {context}: root is null");
                return;
            }

            var renderers = root.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            if (renderers == null || renderers.Length == 0)
            {
                Debug.LogWarning($"🧩 [BlendshapeDebug] {context}: no SkinnedMeshRenderer found under '{root.name}'");
                return;
            }

            int totalBlendshapes = 0;
            int meshesWithBlendshapes = 0;

            foreach (var r in renderers)
            {
                if (r == null) continue;
                var mesh = r.sharedMesh;
                if (mesh == null) continue;

                int count = mesh.blendShapeCount;
                if (count == 0 && !includeZeroBlendshapeMeshes) continue;

                if (count > 0) meshesWithBlendshapes++;
                totalBlendshapes += count;

                var sb = new StringBuilder(4096);
                sb.AppendLine($"🧩 [BlendshapeDebug] {context}: Renderer='{r.name}' Path='{GetTransformPath(r.transform, root.transform)}' Mesh='{mesh.name}' blendShapeCount={count}");
                for (int i = 0; i < count; i++)
                {
                    sb.AppendLine($"  - [{i}] {mesh.GetBlendShapeName(i)}");
                }
                Debug.Log(sb.ToString());
            }

            Debug.Log($"🧩 [BlendshapeDebug] {context}: scanned {renderers.Length} SkinnedMeshRenderer(s), meshesWithBlendshapes={meshesWithBlendshapes}, totalBlendshapes={totalBlendshapes}");
        }

        /// <summary>
        /// Dump likely facial rig bones (jaw/mouth/lips/etc.) so we can attempt jaw-bone-driven lip sync
        /// when the model has no blendshapes.
        /// </summary>
        public static void DumpRigHints(GameObject root, string context)
        {
            if (root == null)
            {
                Debug.LogWarning($"🧩 [BlendshapeDebug] {context}: root is null (rig hints)");
                return;
            }

            var sb = new StringBuilder(4096);
            sb.AppendLine($"🧩 [BlendshapeDebug] {context}: rig hints for '{root.name}'");

            // Scan transform hierarchy for likely facial bones by name.
            var all = root.GetComponentsInChildren<Transform>(true);
            int hits = 0;
            foreach (var t in all)
            {
                if (t == null) continue;
                var n = (t.name ?? "").ToLowerInvariant();
                if (n.Contains("jaw") || n.Contains("mouth") || n.Contains("lip") || n.Contains("teeth") || n.Contains("tongue") || n.Contains("head"))
                {
                    hits++;
                    sb.AppendLine($"  - transform: {GetTransformPath(t, root.transform)}");
                }
            }

            // Also dump skinned mesh bone info (rootBone + bones[] count).
            var renderers = root.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            if (renderers != null && renderers.Length > 0)
            {
                sb.AppendLine($"🧩 [BlendshapeDebug] {context}: SkinnedMeshRenderer bone info");
                foreach (var r in renderers)
                {
                    if (r == null) continue;
                    var mesh = r.sharedMesh;
                    sb.AppendLine($"  - renderer='{r.name}' mesh='{(mesh != null ? mesh.name : "null")}' bones={r.bones?.Length ?? 0} rootBone='{(r.rootBone != null ? r.rootBone.name : "null")}'");
                }
            }

            sb.AppendLine($"🧩 [BlendshapeDebug] {context}: rig hint matches={hits} (note: name-based heuristic)");
            Debug.Log(sb.ToString());
        }

        public static void DumpRendererBlendshapes(SkinnedMeshRenderer renderer, string context)
        {
            if (renderer == null)
            {
                Debug.LogWarning($"🧩 [BlendshapeDebug] {context}: renderer is null");
                return;
            }
            var mesh = renderer.sharedMesh;
            if (mesh == null)
            {
                Debug.LogWarning($"🧩 [BlendshapeDebug] {context}: renderer '{renderer.name}' has no sharedMesh");
                return;
            }

            int count = mesh.blendShapeCount;
            var sb = new StringBuilder(4096);
            sb.AppendLine($"🧩 [BlendshapeDebug] {context}: Renderer='{renderer.name}' Mesh='{mesh.name}' blendShapeCount={count}");
            for (int i = 0; i < count; i++)
            {
                sb.AppendLine($"  - [{i}] {mesh.GetBlendShapeName(i)}");
            }
            Debug.Log(sb.ToString());
        }

        private static string GetTransformPath(Transform t, Transform root)
        {
            if (t == null) return "(null)";
            if (root == null) return t.name;

            var sb = new StringBuilder(256);
            var cur = t;
            while (cur != null)
            {
                if (sb.Length == 0) sb.Insert(0, cur.name);
                else sb.Insert(0, cur.name + "/");

                if (cur == root) break;
                cur = cur.parent;
            }
            return sb.ToString();
        }
    }
}


