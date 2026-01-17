using UnityEngine;
using UnityEditor;

public class CreateDummyMaterials : MonoBehaviour
{
    private const string PBR_SHADER_GUID = "b9d29dfa1474148e792ac720cbd45122"; // glTF-pbrMetallicRoughness
    private const string UNLIT_SHADER_GUID = "c87047c884d9843f5b0f4cce282aa760"; // glTF-unlit

    [MenuItem("Tools/Create glTFast Resources")]
    public static void CreateResources()
    {
        EnsureDirectory();

        CreateMaterial("Assets/Resources/GltFast_PBR_Reference.mat", PBR_SHADER_GUID);
        CreateMaterial("Assets/Resources/GltFast_Unlit_Reference.mat", UNLIT_SHADER_GUID);
        
        AssetDatabase.Refresh();
        Debug.Log("✅ Created Dummy Materials in Assets/Resources/");
    }

    private static void EnsureDirectory()
    {
        if (!AssetDatabase.IsValidFolder("Assets/Resources"))
        {
            AssetDatabase.CreateFolder("Assets", "Resources");
        }
    }

    private static void CreateMaterial(string path, string shaderGuid)
    {
        var shaderPath = AssetDatabase.GUIDToAssetPath(shaderGuid);
        var shader = AssetDatabase.LoadAssetAtPath<Shader>(shaderPath);

        if (shader == null)
        {
            Debug.LogError($"❌ Could not find shader with GUID {shaderGuid}");
            return;
        }

        Material mat = new Material(shader);
        
        // --- CRITICAL: Force Texture Variant ---
        // Unity strips shader variants that aren't used. 
        // We need to simulate a "Textured" material so the textured variant is included.
        Texture2D dummyTex = Texture2D.whiteTexture; 
        
        // Assign to common PBR/Unlit texture slots
        if (mat.HasProperty("_BaseMap")) mat.SetTexture("_BaseMap", dummyTex); // URP/glTF
        if (mat.HasProperty("_MainTex")) mat.SetTexture("_MainTex", dummyTex); // Built-in/Legacy
        if (mat.HasProperty("baseColorTexture")) mat.SetTexture("baseColorTexture", dummyTex); // Specific glTF prop?

        AssetDatabase.CreateAsset(mat, path);
        Debug.Log($"   Creating Textured Material: {path} using {shader.name}");
    }
}
