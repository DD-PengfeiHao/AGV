# Robod 网络接口说明文档
# 报文格式

默认端口: 19208

![image](Robod 网络接口说明文档/B3JtbiUY5oAhWQxEQXLc5hkEnPf.png)

# 指令返回格式

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| ret_code | number | API错误码 | 否 |
| err_msg | string | 错误信息 | 否 |

# 关闭操作系统

请求

- 编号: 5000 (0x1388)

- 名称 :robot_core_shutdown_req

- 描述:关闭操作系统

- JSON 数据区:无

请求示例

`5A 01 00 00 00 00 00 00 13 88 00 00 00 00 00 00`

响应

- 编号:15000(0x3A98)

- 名称 :robot_core_shutdown_res

- JSON 数据区:无

# 关闭 Robokit

请求

- 编号: 5001 (0x1389)

- 名称 :robot_core_end_req

- 描述:关闭 Robokit程序

- JSON 数据区:无

请求示例

`5A 01 00 00 00 00 00 00 13 89 00 00 00 00 00 00`

响应

- 编号:15001(0x3A99)

- 名称 :robot_core_end_res

- JSON 数据区:无

# 启动Robokit

请求

- 编号: 5002 (0x138A)

- 名称 :robot_core_start_req

- 描述:启动Robkit程序

- JSON 数据区:无

请求示例

`5A 01 00 00 00 00 00 00 13 8A 00 00 00 00 00 00`

响应

- 编号:15002(0x3A9A)

- 名称 :robot_core_start_res

- JSON 数据区:无

# 重启操作系统

请求

- 编号: 5003 (0x138B)

- 名称 :robot_core_reboot_req

- 描述:重启操作系统

- JSON 数据区: 无

请求报头

`5A 01 00 00 00 00 00 00 13 8B 00 00 00 00 00 00`

响应

- 编号:15003(0x3A9B)

- 名称 :robot_core_reboot_res

- JSON 数据区: 无

# 重启Robokit

请求

- 编号: 5004 (0x138C)

- 名称 :robot_core_restart_req

- 描述:重新启动 Robokit 程序

- JSON 数据区: 见下表

请求报文

`5A 01 00 00 00 00 00 00 13 8C 00 00 00 00 00 00`

响应

- 编号:15004(0x3A9C)

- 名称 :robot_core_restart_res

- JSON 数据区: 无

# 配置robod

请求

- 编号: 5010 (0x1392)

- 名称 :robot_core_config_req

- 描述:配置robod

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 92 00 00 00 00 00 00`

响应

- 编号:15010(0x3AA2)

- 名称 :robot_core_config_res

- 描述:配置robod

- JSON 数据区: 无

# 查询Robokit 运行状态

请求

- 编号: 5011 (0x1393)

- 名称 :robot_core_status_req

- 描述:查询rbk状态

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 93 00 00 00 00 00 00`

响应

- 编号:15011(0x3AA3)

- 名称 :robot_core_status_res

- 描述:查询Robokit 运行状态

- JSON 数据区: 无

响应示例

```json
{
"count": 1,
"cpu": 39,
"cpu_temp": 74,
"is_running": true,
"mem": 33.94921875,
"pid": 22943,
"run_time": 0
}
```

# 下载机器人备份文件

请求

- 编号: 5012 (0x1394)

- 名称 :robot_core_download_backupfile_req

- 描述:下载机器人备份文件

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| file_path | string | 文件路径 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 94 00 00 00 00 00 00`

响应

- 编号:15014(0x3AA6)

- 名称 :robot_core_download_backupfile_res

- 描述:下载机器人备份文件

- JSON 数据区: 无

# 连接无线Wi-Fi

请求

- 编号: 5020 (0x139C)

- 名称 :robot_core_wifi_req

- 描述:连接无线网络

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| ssid | string | SSID名称 | 否 |
| passwd | string | 密码 | 是 |
| nonBroadcast | bool | true：隐藏网络 false：广播网络 | 是 |

连接无线网络时，如果当前连接的服务器ip是无线网ip，则切换完无线网络后会断开，不会有返回数据，所以建议在连接本地有线ip情况下切换网络，切换成功后会返回数据，如果发送的json数据为空，则返回错误码

请求报文

`5A 01 00 00 00 00 00 55 13 9C 00 00 00 00 00 00`

请求JSON

```json
{
"ssid": "Seer-Robotics-5G", 
"passwd": "nb@seer-robotics.com",
"nonBroadcast": false
}
```

响应

- 编号:15020(0x3AAC)

- 名称 :robot_core_wifi_res

- JSON 数据区: 无

# 配置无线网卡IP

请求

- 编号: 5021 (0x139D)

- 名称 :robot_core_setip_req

- 描述:配置无线网卡IP

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| dhcp | bool | 是否启用动态获取 | 否 |
| ip | string | 配置的ip | 否 |
| gateway | string | 配置的网关 | 是 |
| mask | string | 子网掩码 | 否 |

如果当前连接的IP是无线时，配置完会断开，不会有返回数据，所以建议使用网线配置网络

请求报文

`5A 01 00 00 00 00 00 4D 13 9D 00 00 00 00 00 00`

5A 01 00 00 00 00 00 4D 13 9D 00 00 00 00 00 00

请求JSON

```json
{
"dhcp": true, 
"ip": "192.168.4.208",
"gateway": "",
"mask":"255.255.255.0"
}
```

响应

- 编号:15021(0x3AAD)

- 名称 :robot_core_setip_res

- JSON 数据区: 无

# 查询无线网卡信息

请求

- 编号: 5022 (0x139E)

- 名称 :robot_core_net_req

- 描述:查询当前连接的 Wi-Fi 网络信息

- JSON 数据区: 无 如果当前无线网卡处于关闭状态，则返回数据为空

请求报文

`5A 01 00 00 00 00 00 00 13 9E 00 00 00 00 00 00`

响应

- 编号:15022(0x3AAE)

- 名称 :robot_core_net_res

- JSON 数据区: 见下表

响应示例

```json
{
        "GENERAL.CON-PATH:": "/org/freedesktop/NetworkManager/ActiveConnection/10",
        "GENERAL.CONNECTION:": "SEER-TEST",
        "GENERAL.DEVICE:": "wlan0",
        "GENERAL.HWADDR:": "64:D6:9A:BE:C7:06",
        "GENERAL.MTU:": "1500",
        "GENERAL.STATE:": "100 (connected)",
        "GENERAL.TYPE:": "wifi",
        "IP4.ADDRESS[1]:": "192.168.26.249/24",
        "IP4.DNS[1]:": "202.96.209.5",
        "IP4.DNS[2]:": "202.96.209.133",
        "IP4.GATEWAY:": "192.168.26.1",
        "IP4.ROUTE[1]:": "dst = 0.0.0.0/0, nh = 192.168.26.1, mt = 600",
        "IP4.ROUTE[2]:": "dst = 192.168.26.0/24, nh = 0.0.0.0, mt = 600",
        "IP6.ADDRESS[1]:": "fe80::9baa:22c2:714:5fcd/64",
        "IP6.GATEWAY:": "--",
        "IP6.ROUTE[1]:": "dst = fe80::/64, nh = ::, mt = 600",
        "Mac": "64:D6:9A:BE:C7:06", //当前无线网卡的 MAC 地址
        "bssid": "e8:10:98:ae:4f:d1", //当前已连接的 SSID 的物理设备 AP MAC 地址
        "dhcp": true,  //是否启动 dhcp(动态分配 IP)
        "gateway": "192.168.26.1",//子网掩码
        "ip": "192.168.26.249", //无线网卡 IP
        "mask": "255.255.255.0", //子网掩码
        "name": "wlan0", //当前无线网卡名称
        "rssi": -60   //当前信号强度
}
```

# 查询所有可连接 Wi-Fi列表

请求

- 编号: 5023 (0x139F)

- 名称 :robot_core_wifilist_req

- 描述:查询所有可连接 Wi-Fi 列表 (隐藏网络不在其中)

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 9F 00 00 00 00 00 00`

响应

- 编号:15023(0x3AAF)

- 名称 :robot_core_wifilist_res

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| current_wifi | string | 当前已连接SSID，未连接则未空 | 否 |
| wifi_list | array | 无线网列表 | 否 |
| is_encrypted | bool | 无线网是否加密 | 否 |
| rssi | double | 无线网信号强度 | 否 |
| ssid | string | 网络名称 | 否 |

响应示例

```json
{
"current_wifi": "Seer-Robotics-5G",
"wifi_list": [
      {
      "is_encrypted": true,
      "rssi": 73,
      "ssid": "Seer-Robotics-5G"
      }
    ]
}
```

# 配置机器人的热点参数

请求

- 编号:5031(0x13A7)

- 名称 :robot_core_hotspot_config_req

- 描述:配置机器人的热点参数

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| dhcp | bool | 是否启用动态获取 | 否 |
| ip | string | 配置的ip | 否 |
| gateway | string | 配置的网关 | 是 |
| mask | string | 子网掩码 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 A7 00 00 00 00 00 00`

响应

- 编号:15031(0x3AB7)

- 名称 :robot_core_hotspot_config_res

- JSON 数据区: 无

# 启动机器人热点

请求

- 编号:5032(0x13A8)

- 名称 :robot_core_hotspot_start_req

- 描述:启动机器人热点

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| ssid | string | 热点名称 | 否 |
| passwd | string | 热点密码 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 A8 00 00 00 00 00 00`

响应

- 编号:15032(0x3AB8)

- 名称 :robot_core_hotspot_start_res

- JSON 数据区: 无

# 停止机器人热点

请求

- 编号:5033(0x13A9)

- 名称 :robot_core_hotspot_stop_req

- 描述:停止机器人热点

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 A9 00 00 00 00 00 00`

响应

- 编号:15033(0x3AB9)

- 名称 :robot_core_hotspot_stop_res

- JSON 数据区: 无

# 修复机器人热点

请求

- 编号:5034(0x13AA)

- 名称 :robot_core_hotspot_fix_req

- 描述:修复机器人热点

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 AA 00 00 00 00 00 00`

响应

- 编号:15034(0x3ABA)

- 名称 :robot_core_hotspot_fix_res

- JSON 数据区: 无

# 查询热点状态

请求

- 编号:5035(0x13AB)

- 名称 :robot_core_hotspot_status_req

- 描述:查询热点状态

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 AB 00 00 00 00 00 00`

响应

- 编号:15035(0x3ABB)

- 名称 :robot_core_hotspot_status_res

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| is_hotspot | bool | 是否启用热点 | 否 |
| passwd | string | 热点密码 | 否 |
| ssid | string | 热点名称 | 否 |

响应示例

```json
{
"is_hotspot": false,
"passwd": "12345678",
"ssid": "SeerRobot_AMB-300-NEW1"
}
```

# 查询Robod版本

请求

- 编号:5041(0x13B1)

- 名称 :robot_core_robod_version_req

- 描述:查询robod版本

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 B1 00 00 00 00 00 00`

响应

- 编号:15041(0x3AC1)

- 名称 :robot_core_robod_version_req

- JSON 数据区: 见下表 如果本地有线网卡禁用，则MAC地址为空

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| cardexist | bool | 本地192.168.192.5网卡是否启用 | 否 |
| mac | string | 本地有线网卡MAC地址 | 是 |
| version | string | robod版本号 | 否 |
| wifiStatus | bool | true:有线网卡已禁用 false:已启用 | 否 |
| isAutoCheckEthernetConnection | bool | true:定时检查有线网卡连接状态 false:不定时检查 | 否 |

响应示例

```json
{
"cardexist": true,
"mac": "40:62:31:01:D5:5A",
"version": "2.1.6",
"wifiStatus":false,
"isAutoCheckEthernetConnection":false
}
```

# 下载调试文件

请求

- 编号:5042(0x13B2)

- 名称 :robot_core_robod_all1_req

- 描述:把 Config.ini 配置的相关所有文件压缩成.zip传输给客户端(子线程运行)

- JSON 数据区:无

请求报文

`5A 01 00 00 00 00 00 00 13 B2 00 00 00 00 00 00`

响应

- 编号:15042(0x3AC2)

- 名称 :robot_core_robod_all1_res

- JSON 数据区: 无

# 查询固件id

请求

- 编号:5043(0x13B3)

- 名称 :robot_core_robod_id_req

- 描述:查询固件id

- JSON 数据区: 无

请求示例

`5A 01 00 00 00 00 00 00 13 B3 00 00 00 00 00 00`

响应

- 编号:15043(......)

- 名称 :robot_core_robod_id_res

- 描述:查询固件id

- JSON 数据区: 无

# 启用/禁用网卡

请求

- 编号:5044(0x13B4)

- 名称 :robot_core_networkcard_req

- 描述:控制机器人网卡（启用/禁用等）

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| networkCardIndex | int | 0有线网卡，1无线网卡 | 否 |
| disabled | bool | true:禁用网卡 false:启用 | 否 |

如果当前连接的是无线网卡ip，禁用网卡之后会断开连接，不会有返回数据,
这里的网卡在 Linux 网卡名: eth1

请求报文

`5A 01 00 00 00 00 00 00 13 B4 00 00 00 00 00 00`

请求JSON

```json
{
"networkCardIndex": 1,
"disabled":true
}
```

响应

- 编号:15044(0x3AC4)

- 名称 :robot_core_networkcard_res

- JSON 数据区: 无

# 查询有线网卡信息

请求

- 编号:5045(0x13B5)

- 名称 :robot_core_alxnet_req

- 描述:查询有线网卡信息

- JSON 数据区: 无 如果有线网卡已禁用则返回警告提示

请求报文

`5A 01 00 00 00 00 00 00 13 B5 00 00 00 00 00 00`

响应

- 编号:15045(0x3AC5)

- 名称 :robot_core_alxnet_res

- 描述:查询有线网卡信息

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| dhcp | bool | 是否启用动态获取 | 是 |
| ip | string | IP | 是 |
| gateway | string | 网关 | 是 |
| mask | string | 子网掩码 | 是 |
| name | string | 网卡名称 | 是 |

响应示例

```json
{
"dhcp": 1,
"gateway": "192.168.4.1",
"ip": "192.168.4.95",
"mask": "255.255.255.0",
"name": "本地连接 2"
}
```

# 配置有线网卡网卡IP

请求

- 编号:5046(0x13B6)

- 名称 :robot_core_alxsetip_req

描述:配置有线网卡网卡 IP

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| dhcp | bool | 是否启用动态获取 | 否 |
| ip | string | IP | 否 |
| gateway | string | 网关 | 是 |
| mask | string | 子网掩码 | 否 |
| name | string | 网卡名称 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 B6 00 00 00 00 00 00`

请求JSON

```json
{
"dhcp": false,
"gateway": "192.168.4.1",
"ip": "192.168.4.96",
"mask": "255.255.255.0",
"name": "本地连接 2"
}
```

响应

- 编号:15046(0x3AC6)

- 名称 :robot_core_alxsetip_res

- JSON 数据区: 无

# 获取音频驱动列表及音量大小

请求

- 编号:5047(0x13B7)

- 名称 :robot_core_audiodriverlist_req

- 描述:获取音频驱动列表及音量大小

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 B7 00 00 00 00 00 00`

响应

- 编号:15047(0x3AC7)

- 名称 :robot_core_audiodriverlist_res

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| volume | int | 音量 | 否 |
| list | json array | 驱动名称列表(仅window有值) | 否 |

# 调整音量大小

请求

- 编号:5048(0x13B8)

- 名称 :robot_core_setvolumelevel_req

- 描述:调整音量大小

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| defalutDeviceName | string | 驱动名称(仅window需要，其他缺省) | 否 |
| volume | int | 音量大小(0~100) | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 B8 00 00 00 00 00 00`

响应

- 编号:15048(0x3AC8)

- 名称 :robot_core_audiodriverlist_res

- JSON 数据区: 无

# 查询指定目录文件列表

请求

- 编号:5100(0x13EC)

- 名称 :robot_core_filelist_req

- 描述:查询指定路径下的文件列表

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| path | string | 文件路径 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 EC 00 00 00 00 00 00`

请求JSON

```json
{
"path": "文件路径 "
}
```

响应

- 编号:15100(0x3AFC)

- 名称 :robot_core_filelist_res

- JSON 数据区: 见下表

```json
{
        "file_list": [{
                "created_date_time": "2019-06-19T05:56:44.405",
                "file_path": ".gnupg",
                "is_dir": true,
                "metadataChangeTime": "2019-06-19T05:56:44.405",
                "name": ".gnupg",
                "size": 4
        },{
                "created_date_time": "2019-06-19T05:56:44.405",
                "file_path": ".bashrc",
                "is_dir": false,
                "metadataChangeTime": "2019-06-19T05:56:44.405",
                "name": ".bashrc",
                "size": 3.6826171875
        }]
}
```

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| is_dir | bool | 是否是目录 | 否 |
| name | string | 文件名 | 否 |
| size | int64 | 文件大小(KB) | 否 |
| created_date_time | string | 创建日期 | 否 |
|  |  |  |  |

# 上传文件

请求

- 编号:5110(0x13F6)

- 名称 :robot_core_uploadfile_req

- 描述:上传配置文件

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| path | string | 文件路径 | 否 |
| file_name | string | 文件名 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 F6 00 00 00 00 00 00`

请求JSON

```json
{
"path": "",
"file_name": ""
}
```

响应

- 编号:15110(0x3B06)

- JSON 数据区: 无

# 下载文件

请求

- 编号:5101(0x13ED)

- 名称 :robot_core_getfile_req

- 描述:下载指定路径下的文件

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| path | string | 文件路径 | 否 |
| file_name | string | 文件名 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 ED 00 00 00 00 00 00`

请求JSON

```json
{
    "path": "/opt/.data/rbk/resources/apps/Control",
    "file_name": "default.sctrl"
}
```

响应

- 编号:15101(0x3AFD)

- 名称 :robot_core_getfile_res

- JSON 数据区: 无

# 删除文件

请求

- 编号:5102(0x13EE)

- 名称 :robot_core_removefile_req

- 描述:删除指定路径下的文件

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| path | string | 文件路径 | 否 |
| file_name | string | 文件名 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 EE 00 00 00 00 00 00`

请求JSON

```json
{
"path": " ",
"file_name": ""
}
```

响应

- 编号:15102(0x3AFE)

- 名称 :robot_core_removefile_res

- JSON 数据区: 无

# 查询可下载所有目录名称

请求

- 编号:5103(0x13EF)

- 名称 :robot_core_copyabledirs_req

- 描述:查询机器人上可以下载的所有文件夹名称

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 EF 00 00 00 00 00 00`

响应

- 编号:15103(0x3AFF)

- 名称 :robot_core_copyabledirs_res

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| created_date_time | string | 文件创建日期 | 是 |
| dir_name | string | 文件目录名称 | 是 |
| file_path | string | 文件路径 | 是 |

“如果返回为空，说明当前没有可拷贝的文件”

响应示例

```json
[
  {
  "created_date_time": "2019-04-30T11:00:21",
  "dir_name": "Robokit Crashes",
  "file_path": "C:/SeerRobotics/Robokit/diagnosis/crashes"
  },
  {
  "created_date_time": "2019-04-02T10:07:24",
  "dir_name": "Robokit Logs",
  "file_path": "C:/SeerRobotics/Robokit/diagnosis/log"
  },
  {
  "created_date_time": "2019-04-02T10:09:12",
  "dir_name": "Robokit Debug Logs",
  "file_path": "C:/SeerRobotics/Robokit/diagnosis/log/debug"
  }
]
```

# 更新控制器

请求

- 编号:5104(0x13F0)

- 名称 :robot_core_upgrade_robot_req

- 描述:更新盒子

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 F0 00 00 00 00 00 00`

响应

- 编号:15104(0x3B00)

- 名称 :robot_core_upgrade_robot_res

- JSON 数据区: 无

# 删除机器人的备份文件

请求

- 编号:5105(0x13F1)

- 名称 :robot_core_remove_backupfile_req

- 描述:更新盒子

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| file_path | string | 文件路径 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 F1 00 00 00 00 00 00`

响应

- 编号:15105(0x3B01)

- 名称 :robot_core_remove_backupfile_res

- JSON 数据区: 无

# 激活机器人

请求

- 编号:5106(0x13F2)

- 名称 :robot_core_active_robot_req

- 描述:激活机器人

- JSON 数据区: 无

请求报文

`5A 01 00 00 00 00 00 00 13 F2 00 00 00 00 00 00`

响应

- 编号:15106(0x3B02)

- 名称 :robot_core_active_robot_res

- JSON 数据区: 无

# 获取机器人备份压缩文件列表

请求

- 编号:5107(0x13F3)

- 名称 :robot_core_backup_robotlist_req

- 描述:获取机器人备份压缩文件列表

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| path | string | 文件路径 | 否 |
| file_name | string | 文件名 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 F3 00 00 00 00 00 00`

请求JSON

```json
{
"path": "",
"file_name": ""
}
```

响应

- 编号:15107(0x3B03)

- 名称 :robot_core_backup_robotlist_res

- JSON 数据区: 无

# 导出Robokit 资源文件

请求

- 编号:5108(0x13F4)

- 名称 :robot_core_robod_export_req

- 描述:导出Robokit 在Config.ini 配置的所有文件并打包成.zip

- JSON 数据区:无

请求报文

`5A 01 00 00 00 00 00 00 13 F4 00 00 00 00 00 00`

响应

- 编号:15108(0x3B04)

- 名称 :robot_core_robod_export_req

- JSON 数据区:读取的.zip文件数据

# 导入Robokit资源文件

请求

- 编号:5109(0x13F5)

- 名称 :robot_core_robod_import_req

- 描述:导入Robokit 在Config.ini 配置的所有文件并打包成.zip

- JSON 数据区:读取的.zip文件数据

请求报文

`暂无`

响应

- 编号:15109(0x3B05)

- 名称 :robot_core_robod_import_res

- JSON 数据区:无

# 获取 rbk 警告和错误信息

请求

- 编号:5111(0x13F7)

- 名称 :robot_core_getrbklogtext_req

- 描述:获取 rbk 警告和错误信息

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| path | string | 文件路径 | 否 |
| file_name | string | 文件名 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 F7 00 00 00 00 00 00`

响应

- 编号:15111(0x3B07)

- 名称 :robot_core_getrbklogtext_res

- JSON 数据区:

```json
{
"text": "",
}
```

# 定时自动连接以太网

请求

- 编号:5112(0x13F8)

- 名称 :robot_core_timingConnectionEthernet_req

- 描述:定时自动连接以太网

- JSON 数据区: 见下表

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| isAutoCheckEthernetConnection | bool | 是否连接 | 否 |

请求报文

`5A 01 00 00 00 00 00 00 13 F8 00 00 00 00 00 00`

响应

- 编号:15112(0x3B08)

- 名称:robot_core_timingConnectionEthernet_res

- JSON 数据区: 无

# 以静态IP连接指定无线Wi-Fi

注: 静态IP不支持 192.168.192.x网段

请求

- 编号: 5113(0x13F9)

- 名称 :robot_core_set_linux_ssid_ip_req

- 描述:连接无线网络

- JSON 数据区: 见下表 连接无线网络时，如果当前连接的服务器ip是无线网ip，则切换完无线网络后会断开，不会有返回数据，所以建议在连接本地有线ip情况下切换网络，切换成功后会返回数据，如果发送的json数据为空，则返回错误码

| **字段名** | **类型** | **描述** | **可缺省** |
| --- | --- | --- | --- |
| ssid | string | SSID名称 | 否 |
| passwd | string | 密码 | 是 |
| nonBroadcast | bool | true：隐藏网络 false：广播网络 | 是 |
| dhcp | bool | 是否启用动态获取 | 否 |
| ip | string | 配置的ip | 否 |
| gateway | string | 配置的网关 | 是 |
| mask | string | 子网掩码 | 否 |

请求报文

`5A 01 00 00 00 00 00 55 13 F9 00 00 00 00 00 00`

请求JSON

```json
{
"dhcp": false, 
"ip": "192.168.4.208",
"gateway": "192.168.4.1",
"mask":"255.255.255.0",
"ssid": "Seer-Robotics-5G", 
"passwd": "nb@seer-robotics.com",
"nonBroadcast": false
}
```

响应

- 编号:15113(0x3B)

- 名称 :robot_core_set_linux_ssid_ip_req

- JSON 数据区: 无

# 获取时区列表

请求

- 编号 : 5114 (0X13FA)

- 名称 : robot_core_ntp_timezones_req

- 描述 : 获取时区列表

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 13 FA 00 00 00 00 00 00` 
响应

- 编号: 15114(0x3b0a)

- 名称: robot_core_ntp_timezones_res

- JSON 数据区: 无

# 设置时区

请求

- 编号 : 5115 (0X13FB)

- 名称 : robot_core_ntp_setTimezone_req

- 描述 : 设置时区

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 13 FB 00 00 00 00 00 00` 
响应

- 编号: 15115(0x3b0b)

- 名称: robot_core_ntp_setTimezone_res

- JSON 数据区: 无

# 设置日期时间(yyyy-MM-dd hh:mm:ss)

请求

- 编号 : 5116 (0X13FC)

- 名称 : robot_core_ntp_setDateTime_req

- 描述 : 设置日期时间(yyyy-MM-dd hh:mm:ss)

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 13 FC 00 00 00 00 00 00` 
响应

- 编号: 15116(0x3b0c)

- 名称: robot_core_ntp_setDateTime_res

- JSON 数据区: 无

# 获取当前时间(yyyy-MM-dd hh:mm:ss:zzz)

请求

- 编号 : 5117 (0X13FD)

- 名称 : robot_core_datetime_req

- 描述 : 获取当前时间(yyyy-MM-dd hh:mm:ss:zzz)

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 13 FD 00 00 00 00 00 00` 
响应

- 编号: 15117(0x3b0d)

- 名称: robot_core_datetime_res

- JSON 数据区: 无

# iwconfig命令

请求

- 编号 : 5118 (0X13FE)

- 名称 : robot_core_iwconfig_req

- 描述 : iwconfig命令

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 13 FE 00 00 00 00 00 00` 
响应

- 编号: 15118(0x3b0e)

- 名称: robot_core_iwconfig_res

- JSON 数据区: 无

# 导入 .pxf 证书

请求

- 编号 : 5119 (0X13FF)

- 名称 : robot_core_importpxf_req

- 描述 : 导入 .pxf 证书

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 13 FF 00 00 00 00 00 00` 
响应

- 编号: 15119(0x3b0f)

- 名称: robot_core_importpxf_res

- JSON 数据区: 无

# 获取所有网卡信息

请求

- 编号 : 5120 (0X1400)

- 名称 : robot_core_networkcard_list_req

- 描述 : 获取所有网卡信息

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 00 00 00 00 00 00 00` 
响应

- 编号: 15120(0x3b10)

- 名称: robot_core_networkcard_list_res

- JSON 数据区: 无

# /bin/bash命令

请求

- 编号 : 5121 (0X1401)

- 名称 : robot_core_shell_req

- 描述 : /bin/bash命令

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 01 00 00 00 00 00 00` 
响应

- 编号: 15121(0x3b11)

- 名称: robot_core_shell_res

- JSON 数据区: 无

# 终端的 ping 命令行

请求

- 编号 : 5122 (0X1402)

- 名称 : robot_core_shell_ping_req

- 描述 : 终端的 ping 命令行

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 02 00 00 00 00 00 00` 
响应

- 编号: 15122(0x3b12)

- 名称: robot_core_shell_ping_res

- JSON 数据区: 无

# 配置自动断连时判断网络断开的方式

请求

- 编号 : 5123 (0X1403)

- 名称 : robot_core_disMothod_req

- 描述 : 配置自动断连时判断网络断开的方式

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 03 00 00 00 00 00 00` 
响应

- 编号: 15123(0x3b13)

- 名称: robot_core_disMothod_res

- JSON 数据区: 无

# 导入资源前需要更新覆盖规则

请求

- 编号 : 5124 (0X1404)

- 名称 : robot_core_robod_import_config_req

- 描述 : 导入资源前需要更新覆盖规则

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 04 00 00 00 00 00 00` 
响应

- 编号: 15124(0x3b14)

- 名称: robot_core_robod_import_config_res

- JSON 数据区: 无

# robod 时时状态

请求

- 编号 : 5125 (0X1405)

- 名称 : robot_core_robod_allstatus_req

- 描述 : robod 时时状态

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 05 00 00 00 00 00 00` 
响应

- 编号: 15125(0x3b15)

- 名称: robot_core_robod_allstatus_res

- JSON 数据区: 无

# 导入网络

请求

- 编号 : 5126 (0X1406)

- 名称 : robot_core_import_network_req

- 描述 : 导入网络

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 06 00 00 00 00 00 00` 
响应

- 编号: 15126(0x3b16)

- 名称: robot_core_import_network_res

- JSON 数据区: 无

# 导出网络

请求

- 编号 : 5127 (0X1407)

- 名称 : robot_core_export_network_req

- 描述 : 导出网络

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 07 00 00 00 00 00 00` 
响应

- 编号: 15127(0x3b17)

- 名称: robot_core_export_network_res

- JSON 数据区: 无

# 激活rds系统

请求

- 编号 : 5128 (0X1408)

- 名称 : robot_core_activate_rds_req

- 描述 : 激活rds系统

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 08 00 00 00 00 00 00` 
响应

- 编号: 15128(0x3b18)

- 名称: robot_core_activate_rds_res

- JSON 数据区: 无

# 获取所有robodMake.ini文件

请求

- 编号 : 5129 (0X1409)

- 名称 : robot_core_get_all_robodMakes

- 描述 : 获取所有robodMake.ini文件

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 09 00 00 00 00 00 00` 
响应

- 编号: 15129(0x3b19)

- 名称: robot_core_get_all_robodMakes

- JSON 数据区: 无

# 获取所有调试文件列表(让Roboshop进行下载打包)

请求

- 编号 : 5130 (0X140A)

- 名称 : robot_core_get_debug_fileList_req

- 描述 : 获取所有调试文件列表(让Roboshop进行下载打包)

- 路由区 : 无

- 数据区 : 如下
    ```json
    {        
        "startTime":"2025-07-01 00:00:00",
        "endTime":"2025-07-02 00:00:00"
    }
    ```

请求示例
`5A 01 00 00 00 00 00 00 14 0A 00 00 00 00 00 00` 
响应

- 编号: 15130(0x3b1a)

- 名称: robot_core_get_debug_fileList_res

- 数据区:

```json
{
        "appsData": "/opt/.data",
        "appsPath": "/opt/data",
        "fileList": [{
                "dirName": "Control",
                "filePaths": [
                        "/opt/.data/rbk/resources/apps/Control/default.sctrl"
                ]
        }]
}
```

# 获取当前扫描的AP列表

请求

- 编号 : 5131 (0X140B)

- 名称 : robot_core_aplist_req

- 描述 : 获取当前扫描的AP列表

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 0B 00 00 00 00 00 00` 
响应

- 编号: 15131(0x3b1b)

- 名称: robot_core_aplist_res

- JSON 数据区: 无

# 测试网络

请求

- 编号 : 5132 (0X140C)

- 名称 : robot_core_test_network_req

- 描述 : 测试网络

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 0C 00 00 00 00 00 00` 
响应

- 编号: 15132(0x3b1c)

- 名称: robot_core_test_network_res

- JSON 数据区: 无

# 配置 Robod

请求

- 编号 : 5133 (0X140D)

- 名称 : robot_core_config_robod_req

- 描述 : 配置robod

- JSON 数据区 : 无

请求示例
`5A 01 00 00 00 00 00 00 14 0D 00 00 00 00 00 00` 
响应

- 编号: 15133(0x3b1d)

- JSON 数据区: 无

# 操作 Robod 3.6.5 +

请求

- 编号:5136(0x1410)

- 名称 : robot_core_operate_req

- JSON: 下列 JSON 内容

- 数据区: 下列具体内容

![image](Robod 网络接口说明文档/VjGabWBnEo4jl5xUsJYcGcEJnec.png)

同步头 + 版本号 + 序号(number) + 总长度-16 + 类型1 + 类型2 + JSON长度 + 保留 + 保留

5A 01 0000 0000001F 1410 1410 001F 00 00

说明: 5A0100000000001F14101410001F0000 + [JSON区] + [数据区]

为什么有类型1和类型2，是因为返回时 类型1会+10000返回，这时类型2保持发送时类型

JSON区: 从 16 + json长度 是整个 JSON 区

数据区: 从 JSON区尾部一直到整个报文尾部是整个数据区

## 播放音频

JSON 内容

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
        "type": "getAllInterfaces"
}
```

## 根据网卡名称获取网卡信息

```json
{
        "type": "getNetworkCardInfo",
        "networkCardName": "wlan0"
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

audioPath:音频目录

## 查询指定目录文件列表

```json
{
        "type": "getFileList",
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
        "type": "getDevices"
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

响应

- 编号:15136(0x3b20)

- 数据区:
    - 正确返回请求的数据
    
    - 错误返回统一的错误 JSON

{"err_msg":"Audio not playing","ret_code":40014,"type":"stopAudio"}