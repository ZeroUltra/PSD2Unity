using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEditor;
using System.IO;
using Newtonsoft.Json.Linq;
namespace PSDImporter
{
    public class PSDCreateor
    {
        [MenuItem("Assets/PSDTools/PSD2Scene", priority = 500, validate = true)]
        static bool PSDToSceneValidate()
        {
            return PSDReadJson.IsSelectionPSData();
        }
        [MenuItem("Assets/PSDTools/PSD2Scene", priority = 500, validate = false)]
        static void PSDToScene()
        {
            var obj = Selection.activeObject;
            if (obj != null)
            {
                var psdData = PSDReadJson.ReadJson(AssetDatabase.GetAssetPath(obj));
                CreateScene(psdData);
            }
        }

        [MenuItem("Assets/PSDTools/PSD2UGUI", priority = 500, validate = true)]
        static bool PSDToUGUIValidate()
        {
            return PSDReadJson.IsSelectionPSData();
        }
        [MenuItem("Assets/PSDTools/PSD2UGUI", priority = 500, validate = false)]
        static void PSDToUGUI()
        {
            var obj = Selection.activeObject;
            if (obj != null)
            {
                var psdData = PSDReadJson.ReadJson(AssetDatabase.GetAssetPath(obj));
                CreateUGUI(psdData);
            }
        }

        /// <summary>
        /// 创建场景
        /// </summary>
        private static void CreateScene(PSDData psdData)
        {
            //父对象
            var rootTrans = CreateGo<Transform>(new DirectoryInfo(psdData.psdAssetsFolder).Name, null);
            rootTrans.transform.position = new Vector3(psdData.width * 0.01f * 0.5f, psdData.height * 0.01f * 0.5f, 0f);
            foreach (var item in psdData.listPngData)
            {
                string group = item.groupName == "root/" ? "/" : item.groupName; //有没有图层组
                string pngpath = $"{psdData.psdAssetsFolder}{group}{item.pngName}.png";  //图片路径

                SpriteRenderer sr = null;
                Transform tranParent = rootTrans;
                if (group != "/")
                {
                    var paths = group.Split("/");
                    foreach (var itemPath in paths)
                    {
                        //找到父对象 如果没有则创建
                        var child = tranParent.Find(itemPath);
                        if (child == null)
                        {
                            child = CreateGo<Transform>(itemPath, tranParent);
                            child.transform.localPosition = Vector3.zero;
                        }
                        tranParent = child;
                    }
                }
                sr = CreateGo<SpriteRenderer>(item.pngName, tranParent);
                //sr.transform.SetAsLastSibling();
                sr.transform.position = new Vector3(item.x * 0.01f, item.y * 0.01f, 0);
                sr.sortingOrder = item.index; //倒序排列

                var sp = (Sprite)AssetDatabase.LoadAssetAtPath(pngpath, typeof(Sprite));
                if (sp != null)
                    sr.sprite = sp;
                else
                    Debug.LogError($"not found sprite at: {pngpath}");
            }
            rootTrans.transform.position = Vector3.zero;  //归0
        }

        /// <summary>
        /// 创建UI
        /// </summary>
        private static void CreateUGUI(PSDData psdData)
        {
            Transform canvasTrans = null;
            //创建canvas
            if (GameObject.FindObjectOfType<Canvas>() == null)
            {
                bool menuitem = EditorApplication.ExecuteMenuItem("GameObject/UI/Canvas");
                if (menuitem == false)
                    canvasTrans = CreateGo<Canvas>("Canvas", null).transform;
            }
            if (canvasTrans == null)
                canvasTrans = GameObject.FindObjectOfType<Canvas>().transform;
            var rootRectTrans = CreateGo<RectTransform>(new DirectoryInfo(psdData.psdAssetsFolder).Name, canvasTrans,"UI");
            rootRectTrans.position = new Vector3(psdData.width * 0.5f, psdData.height * 0.5f, 0);
            rootRectTrans.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, psdData.width);
            rootRectTrans.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical, psdData.height);

            //UGUI 排序 排序靠下 优先显示
            foreach (var item in psdData.listPngData)
            {
                //PngData item = listpngDatas[i];
                string group = item.groupName == "root/" ? "/" : item.groupName; //有没有图层组
                string pngpath = $"{psdData.psdAssetsFolder}{group}{item.pngName}.png";  //图片路径

                Image img = null;
                RectTransform tranParent = rootRectTrans;
                if (group != "/")
                {
                    var paths = group.Split("/");
                    foreach (var itemPath in paths)
                    {
                        //找到父对象 如果没有则创建
                        var child = tranParent.Find(itemPath) as RectTransform;
                        if (child == null)
                        {
                            child = CreateGo<RectTransform>(itemPath, tranParent, "UI");
                            child.transform.localPosition = Vector3.zero;
                        }
                        tranParent = child;
                    }
                }
                //TODO:可以根据item.pngName 自行添加其他UI组件
                img = CreateGo<Image>(item.pngName, tranParent, "UI");
                img.rectTransform.position = new Vector3(item.x, item.y, 0);
                var sp = (Sprite)AssetDatabase.LoadAssetAtPath(pngpath, typeof(Sprite));
                if (sp != null)
                {
                    img.sprite = sp;
                    img.SetNativeSize();
                }
                else
                    Debug.LogError($"not found sprite at: {pngpath}");
            }
            rootRectTrans.transform.localPosition = Vector3.zero;
            rootRectTrans.transform.localScale = Vector3.one;
        }

        private static T CreateGo<T>(string goName, Transform parent, string LayerName = null) where T : Component
        {
            GameObject go = new GameObject(goName);
            if (!string.IsNullOrEmpty(LayerName))
            {
                go.layer = LayerMask.NameToLayer(LayerName);
            }
            go.transform.SetParent(parent);
            if (typeof(T) != typeof(Transform))
            {
                T t = go.AddComponent<T>();
                return t;
            }
            else
                return go.transform as T;
        }

        //private static void CreatePrefab(GameObject prefab, string goname)
        //{
        //    var go = PrefabUtility.SaveAsPrefabAssetAndConnect(prefab, selectionAssetFolder + "/" + goname + ".prefab", InteractionMode.AutomatedAction);
        //    EditorGUIUtility.PingObject(go);
        //}
    }
}
