# Linux 下启动 .exe
1. 安装 wine
**sudo apt intall wine-stable**

2. 使用命令或者脚本启动
**wine /home/xx.exe**

3. 创建 xx.sh 脚本

> **currentPath=` ** **cd ** **$(dirname ** **$0 ** **); ** **pwd ** **-P`**
> 
> **cd ** ** ** **" ** **$currentPath ** **" **
> 
> **wine ** **$currentPath ** **/xx.exe**

4. 执行 ./xx.sh 脚本
    1. 如果提示`因为权限无法启动修改.sh文件权限`
    **sudo chmod a+x xx.sh**
    
    2. 如果执行./xx.sh 启动后出现
    
    `0009:err:winediag:SECUR32_initNTLMSP ntlm_auth was not found or is outdated. Make sure that ntlm_auth >= 3.0.25 is in your path. Usually, you can find it in the winbind package of your distribution.`
    
    解决办法:
    **sudo apt install winbind**