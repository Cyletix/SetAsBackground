param(
    [int]$monitorIndex,
    [string]$wallpaperPath,
    [string]$fillMode  # 例如："Fill", "Fit", "Stretch", "Tile", "Center", "Span"
)

Write-Output "调试输出：monitorIndex = $monitorIndex, wallpaperPath = $wallpaperPath, fillMode = $fillMode"

# 创建 DesktopWallpaper COM 对象
$desktopWallpaper = New-Object -ComObject DesktopWallpaper

# 获取指定显示器的 ID
$monitorId = $desktopWallpaper.GetMonitorDevicePathAt($monitorIndex)
if (-not $monitorId) {
    Write-Error "未能获取显示器索引 $monitorIndex 对应的 ID"
    exit 1
}

# 根据 fillMode 参数确定位置值
switch ($fillMode) {
    "Fill"    { $position = 0 }   # DesktopWallpaperPosition.Fill
    "Fit"     { $position = 1 }   # Fit
    "Stretch" { $position = 2 }   # Stretch
    "Tile"    { $position = 3 }   # Tile
    "Center"  { $position = 4 }   # Center
    "Span"    { $position = 5 }   # Span
    default   { $position = 0 }   # 默认使用 Fill
}

# 设置填充方式
$desktopWallpaper.SetPosition($position)

# 设置该显示器的壁纸
$desktopWallpaper.SetWallpaper($monitorId, $wallpaperPath)

Write-Output "已成功设置显示器 $monitorIndex 的壁纸为：$wallpaperPath, 填充方式为：$fillMode"
