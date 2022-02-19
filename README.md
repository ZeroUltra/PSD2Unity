# PSD2Unity
将psd导入到Unity项目,生成UGUI界面和场景

## How to use

1. 将`PSDImporter`导入到Unity

2. 将ps脚本放在PS软件脚本文件夹

   ![image-20220219221748479](img/image-20220219221748479.png)

2. PS中操作

   ![image-20220219221854573](img/image-20220219221854573.png)

   ​					![image-20220219221920658](img/image-20220219221920658.png)

   等待一段时间之后,在对应的文件夹会生成相应的资源文件

   ![image-20220219222232023](img/image-20220219222232023.png)

3. 将生成的文件导入Unity中,然后将图片格式设置成`Sprite`

4. 选中生成的`xxx.ps.json`,然后右键`PSDTools/PSD2Scene`或者`PSDTools/PSD2UGUI`生成界面

   ![gif](img/1.gif)

   

---

### 参考

 ❤️ ❤️ ❤️ ❤️ ❤️

[Spine 2D - LayersToPNG.jsx fix for Photoshop CC (github.com)](https://gist.github.com/nzhul/5ef666d5960423fed0de)