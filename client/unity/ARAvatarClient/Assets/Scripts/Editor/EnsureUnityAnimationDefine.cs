using System;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace AIChatAR.Editor
{
    /// <summary>
    /// glTFast exposes animation APIs (e.g. GetAnimationClips) behind the UNITY_ANIMATION scripting define.
    /// This editor utility ensures the define is enabled for common build targets.
    /// </summary>
#if UNITY_EDITOR
    [InitializeOnLoad]
    public static class EnsureUnityAnimationDefine
    {
        private const string Define = "UNITY_ANIMATION";

        static EnsureUnityAnimationDefine()
        {
            try
            {
                EnsureForGroup(BuildTargetGroup.Android);
                EnsureForGroup(BuildTargetGroup.iOS);
                EnsureForGroup(BuildTargetGroup.Standalone);
            }
            catch (Exception)
            {
                // Don't spam console if Unity versions change API surface; this is best-effort.
            }
        }

        private static void EnsureForGroup(BuildTargetGroup group)
        {
            var symbols = PlayerSettings.GetScriptingDefineSymbolsForGroup(group) ?? string.Empty;
            if (symbols.Contains(Define))
            {
                return;
            }

            var next = string.IsNullOrEmpty(symbols) ? Define : $"{symbols};{Define}";
            PlayerSettings.SetScriptingDefineSymbolsForGroup(group, next);
        }
    }
#endif
}


