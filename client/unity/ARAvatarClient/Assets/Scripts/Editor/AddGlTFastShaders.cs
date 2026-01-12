using UnityEngine;
using UnityEditor;
using UnityEngine.Rendering;

public class AddGlTFastShaders : MonoBehaviour
{
    // GUIDs found during research
    private const string PBR_SHADER_GUID = "b9d29dfa1474148e792ac720cbd45122"; // glTF-pbrMetallicRoughness
    private const string UNLIT_SHADER_GUID = "c87047c884d9843f5b0f4cce282aa760"; // glTF-unlit

    [MenuItem("Tools/Fix glTFast Shaders")]
    public static void AddShaders()
    {
        Debug.Log("🔧 Attempting to add glTFast shaders to Graphics Settings...");

        var pbrShader = AssetDatabase.LoadAssetAtPath<Shader>(AssetDatabase.GUIDToAssetPath(PBR_SHADER_GUID));
        var unlitShader = AssetDatabase.LoadAssetAtPath<Shader>(AssetDatabase.GUIDToAssetPath(UNLIT_SHADER_GUID));

        if (pbrShader == null)
        {
             Debug.LogError($"❌ Could not find PBR Shader with GUID: {PBR_SHADER_GUID}");
        }
        else
        {
             AddShader(pbrShader);
        }

        if (unlitShader == null)
        {
             Debug.LogError($"❌ Could not find Unlit Shader with GUID: {UNLIT_SHADER_GUID}");
        }
        else
        {
             AddShader(unlitShader);
        }

        // Add Universal Render Pipeline/Lit
        Shader urpLit = Shader.Find("Universal Render Pipeline/Lit");
        if (urpLit == null)
        {
             Debug.LogError("❌ Could not find 'Universal Render Pipeline/Lit' shader via Shader.Find()");
        }
        else
        {
             AddShader(urpLit);
        }
    }

    private static void AddShader(Shader shader)
    {
        var graphicsSettings = AssetDatabase.LoadAssetAtPath<GraphicsSettings>("ProjectSettings/GraphicsSettings.asset");
        // Accessing GraphicsSettings via SerializedObject to modify the array
        
        SerializedObject graphicsManager = new SerializedObject(UnityEditor.AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset")[0]);
        SerializedProperty includedShaders = graphicsManager.FindProperty("m_AlwaysIncludedShaders");

        bool exists = false;
        for (int i = 0; i < includedShaders.arraySize; i++)
        {
            var element = includedShaders.GetArrayElementAtIndex(i);
            if (element.objectReferenceValue == shader)
            {
                exists = true;
                break;
            }
        }

        if (!exists)
        {
            int index = includedShaders.arraySize;
            includedShaders.InsertArrayElementAtIndex(index);
            includedShaders.GetArrayElementAtIndex(index).objectReferenceValue = shader;
            graphicsManager.ApplyModifiedProperties();
            Debug.Log($"✅ Added shader '{shader.name}' to Always Included Shaders");
        }
        else
        {
            Debug.Log($"ℹ️ Shader '{shader.name}' is already included.");
        }
    }
}
