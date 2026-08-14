# Robod(SRC5000) 网络接口说明文档
# 请求

默认端口: 19208

报文如下:

<!-- 画板 HVJ7wrMCkhSr08bbr47cDO8yncd 需要相应权限才能下载 -->

同步头 + 版本号 + 序号(number) + 总长度-16 + 类型1 + 类型2 + JSON长度 + 保留

5A 01 0000 0000001F 1410 1410 001F 00 00

说明: 5A0100000000001F14101410001F0000 + [路由器区(JSON)] + [数据区]

为什么有类型1和类型2，是因为返回时 类型1会 + 10000返回，这时类型2保持发送时类型

路由器区(JSON): 从 16 + json长度 是整个 JSON 区

数据区: 从 JSON区尾部一直到整个报文尾部是整个数据区

请求

- 编号:5136(0x1410)

- 名称 : robot_core_operate_req

- JSON: 下列 JSON 内容

- 数据区: 下列具体内容

![image](Robod(SRC5000) 网络接口说明文档/KfudbhSh9oCiMSxmPlbcn5xJnSf.png)

## 播放音频

```json
{
  "type":"playAudio",
  "filePath":"/usr/local/sounds/warning.wav",
  "isLoop":false
}
```

## 停止播放音频

```json
{
  "type":"stopAudio"
}
```

## 获取所有网卡列表

```json
{
   "type": "getAllNetworkInterfaces"
}
```

## 根据网卡名称获取网卡信息

```json
{
    "type": "getNetworkCardInfo",
    "networkCardName": "wlan0"
}
```

## 设置网卡信息

```json
//json区
{
   "type": "setNetworkCardInfo"
}
//数据区
{
    "cardName": "",
    "dhcp": true,
    "gateway": "",
    "ip": "",
    "mask": ""
}
```

## 禁用网卡

```json
{
    "type": "disableNetworkCard",
    "networkCardIndex": 0, //0：有线网卡   1:无线网卡
    "disabled":true   //true:禁用     false:启用
}
```

## 获取WIFI列表

```json
{
   "type": "getWifiList"
}
```

## 连接WIFI

```json
//json区
{
   "type": "connectWifi"
}
//数据区
{

}
```

## 获取所有内置的目录

```json
{
    "type": "getAllDirectories"
}
```

返回数据区:

```json
{
    "audioPath":"/usr/local/etc/.SeerRobotics/rbk/resources/sounds"
}
```

audioPath:音频目录stopAudio

## 查询指定目录文件列表

```json
{
     "type": "getFileList",
     "isRecursive":false,
     "dirPath":"/usr/local/etc/.SeerRobotics/rbk/resources/sounds"
}
```

## 查看文件夹信息

```json
{
     "type": "getStorageInfo",
     "path":"/usr/local"
}
```

## 查看硬盘信息

```json
{
      "type": "getHardDiskInfo"
}
```

响应示例

## 上传文件

```json
{
    "type": "uploadFile",
    "filePath":"/usr/local/etc/.SeerRobotics/rbk/resources/sounds/turnleft.wav"
}
```

数据区:文件内容

## 下载文件

```json
{
    "type": "downloadFile",
    "filePath":"/usr/local/etc/.SeerRobotics/rbk/resources/sounds/turnleft.wav"
}
```

## 删除文件

```json
{
    "type": "removeFile",
    "filePath":"/usr/local/etc/.SeerRobotics/rbk/resources/sounds/turnleft.wav"
}
```

## 获取所有串口信息

```json
{
    "type": "getAllSerialPorts"
}
```

## 保存串口配置

```json
{
    "type": "saveSerialPortsToFile"
}
```

数据区：

```json
[
  {
    "baudRate": 2400,
    "dataBits": 8,
    "parity": 0,
    "portName": "ttyS0",
    "state": 1,
    "stopBits": 1
   }
]
```

## 清除串口配置

```json
{
    "type": "removeSerialPortFromFile",
    "portName": "ttyS0"
}
```

## 关机(关闭操作系统)

```json
{
    "type": "shutdown"
}
```

## 重启(重启操作系统)

```json
{
    "type": "reboot"
}
```

## 启动监听的程序

```json
{
    "type": "startListenApp"
}
```

## 停止监听的程序

```json
{
    "type": "killListenApp"
}
```

## 激活控制器

```json

{
    "type": "activeSRC",
}
```

请求二进制区

- 文件内容

## 获取 SRC 5000 信息

```json
{
    "type": "getSRC5000Info"
}
```

## 设置音量

```json
{
    "type": "setVolume",
    "volumn":90   //0 ~ 100
}
```

## 获取日志列表

```json
{
    "type": "getLogsFileList",
    "isDownloadLogOnly":false, //true:仅下载日志  false:日志 + 资源文件
    "startTime":"2011-11-11 11:11:11:111", //开始时间 yyyy-MM-dd hh:mm:ss
    "endTime":"2011-11-11 11:11:41:111"  //结束时间 yyyy-MM-dd hh:mm:ss
}
```

## 停止监听的程序

```json
{
    "type": "killListenApp"
}
```

## 终端命令

### ping

```json
{
    "type": "shellPing"
}
```

### 其他命令

json区

```json
{
    "type":"shell"
}
```

数据区

--命令\n

```json
{
    "cmd":"df -h\n"
}
```

## 停止监听的程序

```json
{
    "type": "killListenApp"
}
```

## 停止监听的程序

```json
{
    "type": "killListenApp"
}
```

## 停止监听的程序

```json
{
    "type": "killListenApp"
}
```

## 获取 Robokit 数据

```json
{
    "type": "getRobokitData",
    "request": {
      "type": 1000,
      "port":19204,
      "ip":"127.0.0.1",
      "number":999
     }
}
```

## 升级

json区：

```plaintext

{
    "type": "upgradeSRC",
    "fileName": ""
}
```

数据区：zip文件数据

# 响应

- 编号:15136(0x3b20)

- 数据区:
    - 正确返回请求的 JSON 区
    
    - 错误返回统一的 JSON

{"err_msg":"Audio not playing","ret_code":40014,"type":"stopAudio"}