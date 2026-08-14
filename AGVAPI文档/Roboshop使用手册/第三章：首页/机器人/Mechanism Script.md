# Mechanism Script
## **Mechanism Script**

1. **Script Introduction**

The script function is a user-customizable functional component developed by Seer. Users can flexibly implement desired functions using the Python language.

This document primarily introduces the usage of pre-developed mechanism scripts.

2. **Script Usage**

In the Roboshop interface, a **Mechanism Script**  button is provided for managing and invoking scripts.

![image](Mechanism Script/HMZpblcKGo47YMxPL6tc6Ubnnxc.png)

1. **工具栏**

【另存为】：另存为py文件。

【全部拉取】：将机器人内的脚本全部拉取回本地。

【查找】：查找文本内的词汇。

【撤销】：撤销操作。

【恢复】：恢复操作。

【开始】：选中脚本后，点击开始，选择传入参数后执行脚本。

【调试】：调试脚本。

【暂停】：暂停执行脚本。

【刷新】：刷新脚本列表。

2. **脚本列表**

本地存储的脚本列表。

3. **脚本视图**

选中的脚本视图，用于查看脚本代码。

4. **json参数**

执行脚本产生的脚本参数，包括传参及部分脚本内定义的参数。

5. **参数键值**

脚本执行过程中产生的键值。

## 机构脚本新增变化

### 机构脚本云服务器管理

> 💡 
> 与云端交互，不是控制器哦

![image](Mechanism Script/EYZfbgKs8ooY9KxJCsjcaKa6nfg.png)

【syspy禁止上传】为基础文件（从机器人拉取，且禁止上传）

【脚本】显示项目文件

【用户】目前有超级管理员、管理员与用户三类

【项目】只有拥有项目操作权限的账号才拥有

#### 云端项目上传与下载

![image](Mechanism Script/PzkJbCJ5aoHGAXxHn77cRIHqnVg.png)

【上传】上传本地文件到云端

【下载】下载云端文件到本地

【uuid】想要拉取的项目uuid

【获取记录】点击获取云端当前项目的所有上传记录

【上传记录】显示所有上传记录，包括上传时间、项目创建人、上传人、上传人信息、上传消息、下载。

【与前一版本的比较】显示当前选中版本与前一版本的差异文件

【与本地版本的比较】显示当前选中版本与本地版本的差异文件

【uuid】想要上传到的项目uuid

【检查】检查项目uuid是否存在

【上传文件】显示本次上传的文件

【消息】本次上传的消息

#### 云端项目管理

![image](Mechanism Script/YpsObgo1xoRBBFxKdLQcJIZdnme.png)

【上传】选中一个项目后，可以点击向选中项目上传当前本地文件

【下载】选中一个项目后，可以下载选中项目的文件到本地

【刷新】刷新当前的项目管理

【删除】选中一个项目后，可以删除当前选中的项目（删除后不可恢复）

【重命名】选中一个项目后，可以重命名当前选中的项目

【新建】选中一个项目后，可以新建一个项目

【复制】选中一个项目后，可以复制当前选中的项目

【项目】显示所有项目

#### 用户账号

![image](Mechanism Script/UXsCbTKnOo1pkbxhHFgc4qxgnOf.png)

【修改密码】修改当前用户密码

【用户管理】选中一个项目后，可以下载选中项目的文件到本地

【重新登录】登录其他账号

【退出登录】退出当前账号

【修改密码】修改该用户的登录密码

【更改权限】更改该用户拥有的权限

【删除】删除该用户账号

#### 账号权限

> 💡 
> 联系管理员进行权限修改

![image](Mechanism Script/T4IVbgeF6oiNVJxgetEcFCc4n2d.png)

【推送】向云端推送本地项目

【拉取】从云端拉取项目

【重命名】对项目进行重命名

【复制】对项目进行复制

【删除】对项目进行删除

【新建】对项目进行新建

【回滚】拉取云端任意项目的任意版本的历史到本地

【历史记录】拉取云端任意项目的历史记录且允许下载最新的版本到本地

**FAQ：**

1、如何记录uuid多次使用？

在项目目录下新建文件info.py，并在其中添加uuid即可，如下所示

```json
uuid = “be638687-15e5-4c25-b9fe-e0479a42e62f”
```

【注】如果上述这样无法使用，就在uuid前面加一行回车再试试

2、有无普通用户测试账号？

有的。

![image](Mechanism Script/HFpEb2Pl6og5PWx28M9cd9kWnuc.png)

### Json参数可视化

> 💡 
> Roboshop为什么不显示json文件了？
> 
> 根据json参数可视化的需求，目前roboshop不在界面显示json文件了哦，但是文件实际上还是存在的。
> 
> 可以通过下面操作直接可视化操作json文件。

![image](Mechanism Script/U6gJbfVxJoYuj0xcAnLcuUsln0d.png)

【py文件内容】点击py文件后会显示其内容

【参数】点击后运行py文件生成json参数文件，显示可视化json参数列表

#### py脚本文件模板

📎 [模板.py](Mechanism Script/模板.py)

> 💡 
> 如果要生成可视化json列表，要确保【py文件内容】满足以下两点内容：
> 
> 1、在.py文件中定义syspy的路径如下：
> 
> import os
> 
> import sys
> 
> current_file_path = os.path.abspath(__file__)
> 
> current_folder_path = os.path.dirname(current_file_path)
> 
> sys.path.append(current_folder_path)
> 
> sys.path.append(current_folder_path + "/syspy")
> 
> 2、存在 '__main__'函数调用了Module
> 
> if **name**  == '__main__':
> 
> r1 = SimModule()
> 
> args = {}
> 
> Module(r1, args)

#### 使用介绍

![image](Mechanism Script/FteabOjJooz7iEx2f3oc48djnVf.png)

【搜索】在所有分类中搜索包含指定内容名称的参数

【重新生成】情况json参数文件，重新运行py文件生成新的json参数文件

【导入参数】导入json参数文件替换当前文件

【导出参数】将当前json参数文件导出到指定路径

【导出脚本】将当前json参数文件对应的py脚本文件导出到指定路径

【翻译】点击后显示【14】弹框，目前支持16种语言，将会翻译【15】部分的参数说明

【刷新】刷新当前显示

【图标】仅显示当前json参数文件与控制器中对应的json参数文件是否有差异

【重置选中参数】将勾选了的参数值设置为对应默认值

【重置所有参数】将全部参数值均设置为对应默认值

【拉取】从控制器拉取json参数文件到本地

【推送】将当前json参数文件推送到控制器

【类别】参数对应类别，无类别默认为other

【翻译弹框】支持16种语言翻译

【参数说明】对应参数的说明，支持翻译

#### 不使用可视化进行Json文件修改方式

> 💡 
> 如果不想使用json参数可视化，可以如下操作，进行json参数文件修改

![image](Mechanism Script/Ufgmbbkm2onBA7x8NxccznZXngf.png)

1、【菜单】显示菜单

2、【打开文件夹】打开脚本文件所在文件夹，显示如下

![image](Mechanism Script/D1sjb56j4os2vbxsNekcc6u2nLd.png)

3、【params】进入params文件夹找到需要修改的json文件进行修改即可

![image](Mechanism Script/GLtUbbjVIoTohyxfqbGcV7gYnrc.png)