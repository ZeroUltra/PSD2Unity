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
        static (int width, int height) canvasWH; //画布宽高
        static List<PngData> listpngDatas;
        static string selectionAssetFolder;

        [MenuItem("Assets/PSDTools/PSD2Scene", priority = -100, validate = false)]
        static void PSDToScene()
        {
            listpngDatas = PSDReadJson.ReadJson(ref selectionAssetFolder, ref canvasWH);
            if (listpngDatas.Count > 0)
                CreateScene();
        }
        [MenuItem("Assets/PSDTools/PSD2UGUI", priority = -99, validate = false)]
        static void PSDToUGUI()
        {
            listpngDatas = PSDReadJson.ReadJson(ref selectionAssetFolder, ref canvasWH);
            if (listpngDatas.Count > 0)
                CreateUGUI();
        }

        /// <summary>
        /// 创建场景
        /// </summary>
        private static void CreateScene()
        {
            var rootTrans = CreateGo<Transform>(new DirectoryInfo(selectionAssetFolder).Name, null);
            rootTrans.transform.position = new Vector3(canvasWH.width * 0.01f * 0.5f, canvasWH.height * 0.01f * 0.5f, 0f);
            int count = listpngDatas.Count - 1;
            foreach (var item in listpngDatas)
            {
                string group = item.groupName == "root" ? string.Empty : item.groupName; //有没有图层组
                string pngpath = $"{selectionAssetFolder}{group}/{item.pngName}.png";  //图片路径

                SpriteRenderer sr = null;
                if (!string.IsNullOrEmpty(group))
                {
                    if (rootTrans.transform.Find(group) == null)
                    {
                        var go = CreateGo<Transform>(group, rootTrans);
                        go.transform.localPosition = Vector3.zero;
                    }
                    sr = CreateGo<SpriteRenderer>(item.pngName, rootTrans.transform.Find(group));
                }
                else
                {
                    sr = CreateGo<SpriteRenderer>(item.pngName, rootTrans);
                }
                sr.transform.position = new Vector3(item.x * 0.01f, item.y * 0.01f, 0);
                sr.sortingOrder = count - item.index; //倒序排列
                var sp = (Sprite)AssetDatabase.LoadAssetAtPath(pngpath, typeof(Sprite));
                if (sp != null)
                    sr.sprite = sp;
                else
                    Debug.LogError($"not found sprite at: {pngpath}");
            }
            rootTrans.transform.position = Vector3.zero;  //归0
            CreatePrefab(rootTrans.gameObject, rootTrans.gameObject.name);
        }

        /// <summary>
        /// 创建UI
        /// </summary>
        private static void CreateUGUI()
        {
            Transform canvasTrans = null;
            if (GameObject.FindObjectOfType<Canvas>() == null)
            {
                //创建canvas
                bool menuitem = EditorApplication.ExecuteMenuItem("GameObject/UI/Canvas");
                if (menuitem == false)
                    canvasTrans = CreateGo<Canvas>("Canvas", null).transform;
            }
            if (canvasTrans == null)
                canvasTrans = GameObject.FindObjectOfType<Canvas>().transform;
            var rootRectTrans = CreateGo<RectTransform>(new DirectoryInfo(selectionAssetFolder).Name, canvasTrans);
            rootRectTrans.position = new Vector3(canvasWH.width * 0.5f, canvasWH.height * 0.5f, 0);
            rootRectTrans.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, canvasWH.width);
            rootRectTrans.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical, canvasWH.height);

            //UGUI 排序 谁在排序靠下 优先显示
            for (int i = listpngDatas.Count - 1; i >= 0; i--)
            {
                PngData item = listpngDatas[i];
                string group = item.groupName == "root" ? string.Empty : item.groupName; //组
                string pngpath = $"{selectionAssetFolder}{group}/{item.pngName}.png";

                Image img = null;
                if (!string.IsNullOrEmpty(group))
                {
                    if (rootRectTrans.transform.Find(group) == null)
                    {
                        var go = CreateGo<RectTransform>(group, rootRectTrans);
                        go.localPosition = Vector3.zero;
                    }
                    img = CreateGo<Image>(item.pngName, rootRectTrans.transform.Find(group));
                    //TODO:可以根据item.pngName 自行添加其他UI组件

                }
                else
                    img = CreateGo<Image>(item.pngName, rootRectTrans);//TODO:可以根据item.pngName 自行添加其他UI组件

                var sp = (Sprite)AssetDatabase.LoadAssetAtPath(pngpath, typeof(Sprite));
                if (sp != null)
                {
                    img.sprite = sp;
                    img.SetNativeSize();
                }
                else
                    Debug.LogError($"not found sprite at: {pngpath}");
                img.rectTransform.position = new Vector3(item.x, item.y, 0);
            }
            rootRectTrans.transform.localPosition = Vector3.zero;
            rootRectTrans.transform.localScale = Vector3.one;
            CreatePrefab(rootRectTrans.gameObject, rootRectTrans.gameObject.name + "_UI");
        }

        private static T CreateGo<T>(string goName, Transform parent) where T : Component
        {
            GameObject go = new GameObject(goName);
            go.transform.SetParent(parent);

            if (typeof(T) != typeof(Transform))
            {
                T t = go.AddComponent<T>();
                return t;
            }
            else
                return go.transform as T;
        }

        private static void CreatePrefab(GameObject prefab, string goname)
        {
            var go = PrefabUtility.SaveAsPrefabAssetAndConnect(prefab, selectionAssetFolder + goname + ".prefab", InteractionMode.AutomatedAction);
            EditorGUIUtility.PingObject(go);
        }
    }
}
