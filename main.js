const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 800,
    minWidth: 600,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#1a1a2e",
    show: false,
  });

  mainWindow.loadFile("index.html");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // 개발자 도구 (디버깅용) - 배포 시 주석 처리
  // mainWindow.webContents.openDevTools();

  // 개발용: 파일 변경 시 자동 새로고침
  const watchFiles = ["index.html", "styles.css", "renderer.js"];
  watchFiles.forEach((file) => {
    fs.watch(path.join(__dirname, file), () => {
      if (mainWindow) {
        mainWindow.webContents.reloadIgnoringCache();
      }
    });
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC: 파일 선택 다이얼로그
ipcMain.handle("select-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "ZIP Files", extensions: ["zip"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

// IPC: 암호 테스트
ipcMain.handle("test-password", async (event, filePath, password) => {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      return { success: false, error: "empty" };
    }

    // 첫 번째 파일로 테스트
    const testEntry = entries[0];

    try {
      // adm-zip은 암호가 틀리면 예외를 던짐
      const data = zip.readFile(testEntry, password);
      if (data !== null) {
        return { success: true };
      }
      return { success: false };
    } catch (e) {
      return { success: false };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// IPC: ZIP 파일 정보 가져오기
ipcMain.handle("get-zip-info", async (event, filePath) => {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    const isEncrypted = entries.some((entry) => entry.header.flags & 0x1);

    return {
      success: true,
      fileCount: entries.length,
      isEncrypted: isEncrypted,
      files: entries.slice(0, 5).map((e) => e.entryName),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// IPC: 메시지 팝업
ipcMain.handle("show-message", async (event, type, title, message) => {
  const options = {
    type: type, // "info", "warning", "error", "question"
    title: title,
    message: message,
    buttons: ["확인"],
  };
  return dialog.showMessageBox(mainWindow, options);
});
