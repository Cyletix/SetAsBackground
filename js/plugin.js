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
let lastActivatedMonitor = null; // 记录最后激活的显示器 DOM
let cachedPreviewUrl = "";        // 用于轮询更新的全局预览 URL


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
eagle.window.setSize(700,620); // 限制最小宽度高度
eagle.window.setResizable(false); // 禁止调整窗口大小
eagle.window.setAlwaysOnTop(true); // 置顶窗口
eagle.onPluginShow(async () => {
  console.log("Plugin Show");

  // **每次打开窗口都重新获取最新选中的图片**
  globalSelection = await eagle.item.getSelected();

//   const imageContainer = document.getElementById("imageContainer");
//   const selectedImage = document.getElementById("selectedImage");
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
    // selectedImage.src = previewUrl;
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
		  // 取消选中：同时清除最后激活记录（如果就是当前显示器）
		  selectedDisplays = selectedDisplays.filter(d => d.id !== display.id);
		  box.classList.remove("selected");
		  applyBackgroundStyle(box, "", selectedFillMode);
		  if (lastActivatedMonitor === box) {
			lastActivatedMonitor = null;
		  }
		} else {
		  // 选中：记录当前显示器的本地预览为全局缓存时的预览图
		  selectedDisplays.push(display);
		  box.classList.add("selected");
		  // 记录本地预览图，不再实时刷新，保持当时的图片
		  box.loadedPreviewUrl = cachedPreviewUrl;
		  // 更新全局最后激活显示器
		  lastActivatedMonitor = box;
		  // 使用本地预览加载背景
		  if (cachedPreviewUrl) {
			applyBackgroundStyle(box, cachedPreviewUrl, selectedFillMode);
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
		// 只更新最后激活显示器，如果存在的话
		if (lastActivatedMonitor && lastActivatedMonitor.loadedPreviewUrl) {
		  applyBackgroundStyle(lastActivatedMonitor, lastActivatedMonitor.loadedPreviewUrl, selectedFillMode);
		}
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
	  clearInterval(pollingTimer);
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

  // 在 onPluginShow() 最后，添加轮询代码
  let currentSelectionId = null; // 用于记录当前选中的文件ID
  // 初始化缓存（第一次取 previewUrl 作为缓存）
  cachedPreviewUrl = previewUrl; 
  
  const pollingTimer = setInterval(async () => {
	let items = await eagle.item.getSelected();
	if (items && items.length > 0) {
	  let newItem = items[0];
	  if (!currentSelectionId || newItem.id !== currentSelectionId) {
		currentSelectionId = newItem.id;
		globalSelection = items;
		console.log("检测到选中项变化，新图片：", newItem);
		
		let newPreviewUrl = newItem.thumbnailURL || newItem.fileURL;
		if (!newPreviewUrl && newItem.filePath) {
		  newPreviewUrl = "file://" + newItem.filePath;
		}
		if (newPreviewUrl) {
		  // 只更新全局缓存，不刷新已激活显示器
		  cachedPreviewUrl = newPreviewUrl;
		  console.log("更新预览缓存为：", cachedPreviewUrl);
		}
	  }
	}
  }, 1000);
  

  // 如果窗口关闭时需要清除定时器，记得调用 clearInterval(pollingTimer);

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
    // 宽度 100%，高度自动（可能裁剪上下）
    boxElement.style.backgroundSize = "100% auto";
    boxElement.style.backgroundRepeat = "no-repeat";
    break;
    case "stretch":
    // 强制拉伸到 100% 100%
    boxElement.style.backgroundSize = "100% 100%";
    boxElement.style.backgroundRepeat = "no-repeat";
    break;
    case "fit":
    // 使用 contain 保证图片全部显示（可能有留白）
    boxElement.style.backgroundSize = "contain";
    boxElement.style.backgroundRepeat = "no-repeat";
    break;
    case "center":
    // 保持原始大小，居中显示
    boxElement.style.backgroundSize = "auto";
    boxElement.style.backgroundRepeat = "no-repeat";
    break;
    case "tile":
    // 原始大小平铺
    boxElement.style.backgroundSize = "auto";
    boxElement.style.backgroundRepeat = "repeat";
    break;
    case "span":
    // 跨区模式：这里简化实现为 cover（自动裁剪），实际可能需要根据虚拟桌面尺寸计算
    boxElement.style.backgroundSize = "cover";
    boxElement.style.backgroundRepeat = "no-repeat";
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
