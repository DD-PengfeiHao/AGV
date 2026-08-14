# Robod 发布说明
> 💡 
> 名字虽然都叫 Robod,但是它们不能混用

## 机器人-Robod

### 3.6.64 (发布中) - 2025-07-14

1. 新增连接断开时音频报警

2. 优化上传/下载大文件内存占用问题

**SRC-2000(x86):**

https://update-1304552240.cos.ap-shanghai.myqcloud.com/roboshop/linux/repository/Robod-3.6.64-x86-2000.zip

**SRC-800-880-3000(arm64):**

https://update-1304552240.cos.ap-shanghai.myqcloud.com/roboshop/linux/repository/Robod-3.6.64-arm64-800-880-3000.zip

### 3.6.52 (研发中) - 2024-11-11

1. SRC880 控制器新增热点(支持无线网络和热点同时使用)

### 3.6.50 (发布中) - 2024-10-24

1. 新增下载大于400M文件报错机制，防止下载超大文件导致 Robod 崩溃

### 3.6.49 - 2024-09-14

1. 新增判断 hal.sh 存在则使用脚本配置系统

2. 新增开机 24s 后启动 Robod（修复部分控制器开机无法启动的问题）

3. ~~新增下载大于400M文件报错机制，防止下载超大文件导致 Robod 崩溃~~

### 3.6.46 - 2024-08-15

1. 修复升级固件.deb 会偶发 Robod 崩溃的问题 (重启控制器可恢复)

### 3.6.42 - 2024-06-19

1. 去除 alsa 文件拷贝功能

2. 支持固件.deb 包升级

3. 修复禁用/启用无线网卡后，Roboshop 高级配置提示错误的问题

4. 支持 .py 增量更新

### 3.6.34 - 2024-05-23

1. 新增 log/event 文件夹提取

2. 新增外部设置音频驱动接口 (耳机孔或者USB喇叭没有声音时可以尝试【高级配置】->选择【音频输出设备】)

### 3.6.32 - 2024-04-30

1. 增量包升级去除了.so 文件的限制

2. Roboshop 2.4.1.170+【设置->调试模式]】可以打开 【终端命令->打开ssh工具】

### 3.6.28 - 2024-04-23

1. 新增一种顺序安装.deb文件命名规则(seq_0_xx-xxx.deb)

2. 修复 SRC800 无法保存声音的问题

3. 优化下载大文件导致等待时间过长问题

4. 优化单独升级 Robod 不再重启操作系统

### 3.6.24 - 2024-03-06

1. 支持下载 Roboview 文件夹

2. 修复 src-3000 控制器升级 IMU 脚本失败的 bug

### 3.6.22 - 2024-01-11

1. 修复 SRC-3000 耳机孔 50% 音量以下没有声音的问题

2. 把网卡信息发布给主程序 (需要搭配 Roboshop 2.4.1.156 - 高级配置-网卡设置 - Client-Router模式)

### 3.6.19 - 2023-09-21

1. 不再实时计算 Robokit CPU 和 内存占用率及其他传感器温度

### 3.6.12 - 2023-06-20

1. 降低 Robod 的 CPU 占用率

2. 修复 Robokit 重启失败后高级配置依然显示已启动的 bug

### 3.6.11 - 2023-06-06

1. 新增设备温度并记入日志文件

2. 新增音频播放接口

3. 扩展通信协议支持 JSON + 二进制数据同时发送并解析

### 3.6.3 - 2023-04-20

1. 启动 robokit 时增加 --type=robod 字段

### 3.6.2 - 2023-04-12

1. 修复 SRC-3000 和 SRC-800 获取硬件信息失败及偶发出现升级失败的问题

### 3.6.1 - 2023-03-28

1. 修复 wifi 中含有 $9 这种 $+数字导致的无法连网的问题

### 3.6.0 - 2023-03-21

1. 规范应用程序发布

### 3.5.44 - 2023-03-08

1. 修复使用第三方网络客户端设置静态 IP 偶发失败的问题

2. 修复 SRC-3000 脚本升级程序无执行权限的问题

### 3.5.42 - 2023-03-02

1. 修复 SRC2000.4 设置音量后断电重启失效的问题

### 3.5.41 - 2023-02-23

1. 修复 .zip 增量包无法升级的问题

### 3.5.40 - 2023-02-22

1. 修复 SRC-800/SRC-3000 修改时区重启失效的问题

2. 更新了 SRC-3000 的升级脚本程序

3. 优化获取网卡信息超时问题

### 3.5.39 - 2023-02-02

1. 更新系统日志的获取方法

2. 修改中文翻译为中文

### 3.5.38 - 2022-12-5

1. 修复NTP自动对时BUG

2. 删除硬件信息接口，改为兼容以前版本的接口

### 3.5.37 - 2022-11-26

1. 暂时解除升级时防呆检查

2. 修复 SRC-3000 默认配置 192.168.192.1 网关自带网卡无法上网问题

### 3.5.36 - 2022-11-18

1. Robod 日志不再写入系统日志文件

2. 从 Robod 3.5.36+ 以上加入升级包检测 (目前只能检测含有 Robod 3.5.36.deb包的升级包)

3. 优化欧洲时区手动对时错误的问题

4. 针对 SRC-3000 默认配置192.168.192.1网关

### 3.5.35 - 2022-11-10

1.修复多张无线网卡刷新提示网络未连接的问题

### 3.5.34 - 2022-10-13

1. 修复未获取 src-patch 版本号时无法安装 SRC-PATH.deb 的问题

2. 修复 3.5.30~3.5.33 未取 syslog 的bug

注:先升级该版本后，再升级 src-patch 包

### 3.5.32 - 2022-09-30

1. 限制最小 AP 漫游间隔 6s,防止因为数值过小导致 syslog 日志过大

2. 修复 CPU(6300U) 控制器部分音频无法设置音量的问题

### 3.5.31- 2022-09-26

1. 安装 .deb 包校验返回值

2. 适配 SRC-3000 使用第三方无线网络设备

### 3.5.27 - 2022-08-23

1. 增加每次更新记录

2. 限制部分主板安装 Robokit-3.3.x.deb

## 调度服务器-Robod

环境包安装后，请用 Roboshop 【添加设备->辅助程序]->高级配置->升级/备份】功能升级 rds, core

### 4.4.2 (发布中) - 2023-05-05

1. 修复 linux 系统下文件夹无法删除引起升级异常的问题

#### Linux

无任何环境包(只有robod)

[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/7280206/versions/24842413/file/download?fileName=robod%2Flinux-base-rdscore-robod-4.4.2-x86.zip](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/7280206/versions/24842413/file/download?fileName=robod%2Flinux-base-rdscore-robod-4.4.2-x86.zip)

### 4.3.8 (发布中) - 2022-09-30

1. 修复升级时文件被占用不显示报错的问题

2. 修复 docker 中 rds 挂载了 .yml 导致升级失败的问题

#### Windows 环境包

注意: 文件中包含[ **java-11, mariadb-10.3.31-winx64,robod ** ] 如果已经安装过一次，不可再次安装，否则会损坏数据库 
[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/5557127/versions/20413965/file/download?fileName=robod%2FBase_RDSInstaller_4.3.8-new.exe](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/5557127/versions/20413965/file/download?fileName=robod%2FBase_RDSInstaller_4.3.8-new.exe)

#### Windows

无任何环境包(只有robod)
[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/5054151/versions/18090002/file/download?fileName=robod%2FRobodInstaller_4.3.8.exe](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/5054151/versions/18090002/file/download?fileName=robod%2FRobodInstaller_4.3.8.exe)

#### Linux

无任何环境包(只有robod)

[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/5130390/versions/18526559/file/download?fileName=robod%2Flinux-base-rdscore-robod-4.3.8-x86.zip](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/5130390/versions/18526559/file/download?fileName=robod%2Flinux-base-rdscore-robod-4.3.8-x86.zip)

#### Docker

如果是通过 Docker 安装的 rds，请使用特殊版本的 Robod 进行升级 :

[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/1000794/packages/6264611/versions/22133876/file/download?fileName=Linux-Core-Robod-4.3.9-Docker.zip](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/1000794/packages/6264611/versions/22133876/file/download?fileName=Linux-Core-Robod-4.3.9-Docker.zip)

### 4.3.7 - 2022-08-18

1. 修复更多告警显示不完全问题

2. 新增 Roboshop2.4.1.46+ 高级配置->可关闭开机自启动 (Windows) 有效

#### Windows 环境包

包含[java-11, mariadb-10.3.31-winx64,robod]
[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4860327/versions/16962796/file/download?fileName=robod%2FBase_RDSInstaller_4.3.7.exe](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4860327/versions/16962796/file/download?fileName=robod%2FBase_RDSInstaller_4.3.7.exe)

#### Windows

无任何环境包(只有robod)
[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4860324/versions/16962591/file/download?fileName=robod%2FRobodInstaller_4.3.7.exe](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4860324/versions/16962591/file/download?fileName=robod%2FRobodInstaller_4.3.7.exe)

### 4.3.6 - 2022-07-23

1.  优化下载日志:把文件单个下载到本机再压缩成.zip减少服务器运存

#### Windows 环境包

包含[java-11, mariadb-10.3.31-winx64,robod]
[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4756917/versions/16314110/file/download?fileName=Base_RDSInstaller_4.3.6.exe](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4756917/versions/16314110/file/download?fileName=Base_RDSInstaller_4.3.6.exe)

#### Windows

无任何环境包(只有robod)
[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4756789/versions/16314082/file/download?fileName=RobodInstaller_4.3.6.exe](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4756789/versions/16314082/file/download?fileName=RobodInstaller_4.3.6.exe)

#### Linux

无任何环境包(只有robod)
[https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4749609/versions/16272234/file/download?fileName=robod%2Flinux-base-rdscore-robod-4.3.6-x86.zip](https://seer-group.coding.net/api/user/seer-group/project/products/artifacts/repositories/9977006/packages/4749609/versions/16272234/file/download?fileName=robod%2Flinux-base-rdscore-robod-4.3.6-x86.zip)