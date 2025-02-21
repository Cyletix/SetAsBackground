const { exec } = require('child_process');
const path = require('path');

// 指定要设置的显示器索引和壁纸文件路径
const monitorIndex = 0; // 假设要设置第一个显示器
const wallpaperPath = 'C:\\Path\\To\\Your\\wallpaper.jpg';

// 构造 PowerShell 调用命令
const psScriptPath = path.join(__dirname, 'setWallpaper.ps1');
const cmd = `powershell.exe -ExecutionPolicy Bypass -File "${psScriptPath}" ${monitorIndex} "${wallpaperPath}"`;

// 执行脚本
exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error(`调用出错: ${error}`);
    return;
  }
  console.log(`输出: ${stdout}`);
});
