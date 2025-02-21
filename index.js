const wallpaper = require('wallpaper');

(async function() {
  try {
    // 获取当前壁纸路径
    const currentWallpaper = await wallpaper.get();
    console.log("当前壁纸路径:", currentWallpaper);

    // 如果你需要设置壁纸，可使用 wallpaper.set(壁纸路径)
    // 例如：await wallpaper.set('C:\\path\\to\\your\\wallpaper.jpg');
  } catch (error) {
    console.error("操作失败:", error);
  }
})();
