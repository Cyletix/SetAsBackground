/************************************************************
 * plugin.js
 * - 分别用 item.thumbnailURL 或 item.fileURL 用于"插件窗口中的显示器预览"
 * - 用 item.filePath 调用 wallpaper.set() 做真实系统壁纸
 * - 若 filePath 为空, 提示无效
 ************************************************************/

// 注意：这里要求 package.json 中不要设置 "type": "module"
// 并且必须安装 wallpaper@5.0.1 版本 (npm install wallpaper@5.0.1 --save)
const wallpaper = require("wallpaper");

let globalSelection = [];

eagle.onPluginCreate(async (plugin) => {
  console.log("Plugin Created:", plugin);

  // 1. 获取选中的图片
  globalSelection = plugin.selection;
  if (!globalSelection || globalSelection.length === 0) {
    const fallback = await eagle.item.getSelected();
    if (fallback && fallback.length > 0) {
      globalSelection = fallback;
    }
  }

  if (!globalSelection || globalSelection.length === 0) {
    alert("未获取到选中图片，请在 Eagle 中右键使用此插件。");
  }

  // 2. 显示窗口
  await eagle.window.show();
});

eagle.onPluginShow(async () => {
  console.log("Plugin Show");

  const imageContainer = document.getElementById("imageContainer");
  const selectedImage = document.getElementById("selectedImage");
  const monitorsMap = document.getElementById("monitorsMap");
  const toolbar = document.getElementById("toolbar");
  const fillModeSelect = document.getElementById("fillModeSelect");
  const confirmBtn = document.getElementById("confirmBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  if (!globalSelection || globalSelection.length === 0) {
    return;
  }

  // 假设只取第一张
  const item = globalSelection[0];
  console.log("选中图片对象:", item);

  // 预览URL (for plugin preview): 先用 thumbnailURL -> fileURL -> filePath
  let previewUrl = item.thumbnailURL;
  if (!previewUrl) {
    previewUrl = item.fileURL;
  }
  if (!previewUrl && item.filePath) {
    previewUrl = "file://" + item.filePath;
  }
  // 若还为空则无法预览
  if (previewUrl) {
    selectedImage.src = previewUrl;
    imageContainer.classList.remove("hidden");
  } else {
    console.warn("无可用预览URL(无thumbnailURL/fileURL/filePath)");
  }

  // 真正设置壁纸要用 item.filePath
  const realFilePath = item.filePath;
  if (!realFilePath) {
    console.warn("item.filePath 不存在, 无法真正设置系统壁纸!");
  }

  // 多显示器预览
  let selectedDisplays = [];
  let selectedFillMode = "fill";
  monitorsMap.innerHTML = "";

  try {
    const displays = await eagle.screen.getAllDisplays();
    if (!displays || displays.length === 0) {
      alert("未检测到任何显示器");
      return;
    }

    // 计算所有显示器的总范围
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    displays.forEach(d => {
      const { x, y, width, height } = d.bounds;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + width > maxX) maxX = x + width;
      if (y + height > maxY) maxY = y + height;
    });
    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;
    const mapWidth = 600, mapHeight = 400;
    const scale = Math.min(mapWidth / totalWidth, mapHeight / totalHeight);

    displays.forEach((display, index) => {
      const { x, y, width, height } = display.bounds;
      const relX = x - minX;
      const relY = y - minY;
      const boxLeft = relX * scale;
      const boxTop = relY * scale;
      const boxWidth = width * scale;
      const boxHeight = height * scale;

      const box = document.createElement("div");
      box.className = "monitor-box";
      box.style.left = boxLeft + "px";
      box.style.top = boxTop + "px";
      box.style.width = boxWidth + "px";
      box.style.height = boxHeight + "px";

      // 显示器标签
      const label = document.createElement("div");
      label.className = "monitor-label";
      label.textContent = "显示器 " + (index + 1);
      box.appendChild(label);

      // 初始时未选中，背景图为空
      applyBackgroundStyle(box, "", selectedFillMode);

      // 点击切换选择状态
      box.addEventListener("click", () => {
        const found = selectedDisplays.find(d => d.id === display.id);
        if (found) {
          // 取消选中
          selectedDisplays = selectedDisplays.filter(d => d.id !== display.id);
          box.classList.remove("selected");
          applyBackgroundStyle(box, "", selectedFillMode);
        } else {
          // 选中
          selectedDisplays.push(display);
          box.classList.add("selected");
          if (previewUrl) {
            applyBackgroundStyle(box, previewUrl, selectedFillMode);
          }
        }
        console.log("选中显示器:", selectedDisplays.map(d => d.id));
      });

      monitorsMap.appendChild(box);
    });

    // 显示底部 toolbar
    toolbar.classList.remove("hidden");

    // 监听填充方式变化
    fillModeSelect.addEventListener("change", (e) => {
      selectedFillMode = e.target.value;
      console.log("填充方式:", selectedFillMode);
      refreshAllSelectedBoxes();
    });

    // 确认按钮 -> 调用 wallpaper.set() 设置真实系统壁纸
    confirmBtn.onclick = async () => {
      if (!realFilePath) {
        alert("无法设置壁纸: 文件路径无效!(filePath为空)");
        return;
      }
      if (selectedDisplays.length === 0) {
        alert("请选择至少一个显示器");
        return;
      }
      try {
        console.log("设置壁纸:", realFilePath, "填充:", selectedFillMode);
        await wallpaper.set(realFilePath, { scale: selectedFillMode });

        eagle.notification.show({
          title: "设为壁纸",
          description: "壁纸设置成功！",
          duration: 3000
        });
      } catch (err) {
        console.error("设置壁纸失败:", err);
        eagle.notification.show({
          title: "错误",
          description: "设置壁纸出错: " + err.message,
          duration: 3000
        });
      }
    };

    // 取消按钮 -> 隐藏窗口
    cancelBtn.onclick = () => {
      eagle.window.hide();
    };

    function refreshAllSelectedBoxes() {
      const boxes = monitorsMap.querySelectorAll(".monitor-box.selected");
      boxes.forEach(box => {
        applyBackgroundStyle(box, previewUrl, selectedFillMode);
      });
    }
  } catch (err) {
    console.error("获取显示器失败:", err);
    alert("无法加载显示器: " + err.message);
  }
});

/************************************************************
 * 根据 fillMode 改变 box 的 background 样式
 ************************************************************/
function applyBackgroundStyle(boxElement, bgUrl, fillMode) {
  if (!bgUrl) {
    boxElement.style.backgroundImage = "none";
    return;
  }
  boxElement.style.backgroundImage = `url("${bgUrl}")`;
  boxElement.style.backgroundPosition = "center";
  switch (fillMode) {
    case "fill":
      boxElement.style.backgroundSize = "cover";
      boxElement.style.backgroundRepeat = "no-repeat";
      break;
    case "stretch":
      boxElement.style.backgroundSize = "100% 100%";
      boxElement.style.backgroundRepeat = "no-repeat";
      break;
    case "center":
      boxElement.style.backgroundSize = "auto";
      boxElement.style.backgroundRepeat = "no-repeat";
      break;
    case "tile":
      boxElement.style.backgroundSize = "auto";
      boxElement.style.backgroundRepeat = "repeat";
      break;
    default:
      boxElement.style.backgroundSize = "cover";
      boxElement.style.backgroundRepeat = "no-repeat";
      break;
  }
}

/* 其他回调(可选) */
eagle.onPluginRun(() => console.log("onPluginRun"));
eagle.onPluginHide(() => console.log("onPluginHide"));
eagle.onPluginBeforeExit(() => console.log("onPluginBeforeExit"));
