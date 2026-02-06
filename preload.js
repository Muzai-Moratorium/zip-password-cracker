const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // 파일 선택 다이얼로그
  selectFile: () => ipcRenderer.invoke("select-file"),

  // 암호 테스트
  testPassword: (filePath, password) =>
    ipcRenderer.invoke("test-password", filePath, password),

  // ZIP 파일 정보
  getZipInfo: (filePath) => ipcRenderer.invoke("get-zip-info", filePath),

  // 메시지 팝업
  showMessage: (type, title, message) =>
    ipcRenderer.invoke("show-message", type, title, message),
});
