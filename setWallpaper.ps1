param(
    [int]$monitorIndex,
    [string]$wallpaperPath
)

Write-Output "调试输出：monitorIndex = $monitorIndex, wallpaperPath = $wallpaperPath"  # 调试用

# 创建 IDesktopWallpaper COM 对象
$desktopWallpaper = New-Object -ComObject DesktopWallpaper

# 获取指定显示器的 ID
$monitorId = $desktopWallpaper.GetMonitorDevicePathAt($monitorIndex)
if (-not $monitorId) {
    Write-Error "未能获取显示器索引 $monitorIndex 对应的 ID"
    exit 1
}

# 设置该显示器的壁纸
$desktopWallpaper.SetWallpaper($monitorId, $wallpaperPath)
Write-Output "已成功设置显示器 $monitorIndex 的壁纸为：$wallpaperPath"
