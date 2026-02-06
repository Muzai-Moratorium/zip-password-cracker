// DOM 요소
const filePath = document.getElementById("filePath");
const selectFileBtn = document.getElementById("selectFileBtn");
const fileInfo = document.getElementById("fileInfo");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const logContainer = document.getElementById("log");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

// 옵션 요소
const useCommon = document.getElementById("useCommon");
const useNumeric = document.getElementById("useNumeric");
const numDigits = document.getElementById("numDigits");
const useAlphanum = document.getElementById("useAlphanum");
const alphaDigits = document.getElementById("alphaDigits");

// 상태 변수
let currentFilePath = null;
let isRunning = false;
let shouldStop = false;

// 흔한 암호 목록
const COMMON_PASSWORDS = [
  "1234",
  "0000",
  "1111",
  "123456",
  "password",
  "admin",
  "root",
  "12345678",
  "123456789",
  "love",
  "test",
  "pass",
  "123123",
  "asdf",
  "qwerty",
  "2024",
  "2025",
  "2026",
  "2023",
  "korea",
  "korean",
  "ko-KR",
  "koKR",
  "4072",
];

// 로그 함수
function log(message, type = "") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  logContainer.appendChild(entry);
  logContainer.parentElement.scrollTop =
    logContainer.parentElement.scrollHeight;
}

function clearLog() {
  logContainer.innerHTML = "";
}

function updateProgress(percent, text) {
  progressFill.style.width = `${percent}%`;
  progressText.textContent = text;
}

function showModal(type, title, message, password = null) {
  // 비밀번호 있으면 메시지에 추가
  const fullMessage = password
    ? `${message}\n\n비밀번호: ${password}`
    : message;
  window.electronAPI.showMessage(type, title, fullMessage);
}

// 파일 선택
selectFileBtn.addEventListener("click", async () => {
  const path = await window.electronAPI.selectFile();
  if (path) {
    currentFilePath = path;
    filePath.value = path;

    // ZIP 정보 가져오기
    const info = await window.electronAPI.getZipInfo(path);
    if (info.success) {
      fileInfo.classList.remove("hidden");
      fileInfo.innerHTML = `
                파일 수: ${info.fileCount}개<br>
                암호화: ${info.isEncrypted ? "예스!" : "아닌데용?"}<br>
                파일: ${info.files.join(", ")}${info.fileCount > 5 ? "..." : ""}
            `;
      log(`파일 선택됨: ${path.split(/[\\\/]/).pop()}`, "log-info");
    } else {
      fileInfo.classList.add("hidden");
      log(`파일 정보 읽기 실패: ${info.error}`, "log-error");
    }
  }
});

// 중지 버튼
stopBtn.addEventListener("click", () => {
  if (isRunning) {
    shouldStop = true;
    log("중지 요청됨...", "log-error");
  }
});

// 크래킹 시작
startBtn.addEventListener("click", async () => {
  if (!currentFilePath) {
    showModal("warning", "경고", "먼저 ZIP 파일을 선택해주세요.");
    return;
  }

  isRunning = true;
  shouldStop = false;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  clearLog();

  log("크래킹 시작~~ 가보자고~!", "log-info");
  const startTime = Date.now();

  let foundPassword = null;

  try {
    // 1단계: 흔한 암호
    if (useCommon.checked && !shouldStop) {
      foundPassword = await crackCommon();
    }

    // 2단계: 숫자
    if (!foundPassword && useNumeric.checked && !shouldStop) {
      foundPassword = await crackBruteforce(
        "0123456789",
        parseInt(numDigits.value),
        "숫자",
      );
    }

    // 3단계: 영문+숫자
    if (!foundPassword && useAlphanum.checked && !shouldStop) {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      foundPassword = await crackBruteforce(
        chars,
        parseInt(alphaDigits.value),
        "영문+숫자",
      );
    }

    // 결과
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (foundPassword) {
      log(`\n암호 발견: [ ${foundPassword} ]`, "log-success");
      log(`소요 시간: ${elapsed}초`, "log-info");
      showModal(
        "info",
        "성공!",
        `암호를 찾았습니다! (${elapsed}초)`,
        foundPassword,
      );
    } else if (shouldStop) {
      log("\n사용자에 의해 중지됨.", "log-error");
      updateProgress(0, "중지됨");
    } else {
      log("\n❌ 지정된 범위 내에서 암호를 찾지 못했습니다.", "log-error");
      showModal(
        "error",
        "실패",
        "암호를 찾지 못했습니다. 설정을 변경하여 다시 시도해보세요.",
      );
    }
  } catch (e) {
    log(`오류 발생: ${e.message}`, "log-error");
  } finally {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    if (!foundPassword && !shouldStop) {
      updateProgress(100, "완료");
    }
  }
});

// 흔한 암호 테스트
async function crackCommon() {
  log("\n[1단계] 흔한 암호 목록 테스트 중...", "log-info");

  for (let i = 0; i < COMMON_PASSWORDS.length; i++) {
    if (shouldStop) return null;

    const pwd = COMMON_PASSWORDS[i];
    updateProgress((i / COMMON_PASSWORDS.length) * 100, `테스트 중: ${pwd}`);

    const result = await window.electronAPI.testPassword(currentFilePath, pwd);
    if (result.success) {
      return pwd;
    }

    // UI 업데이트를 위한 짧은 딜레이
    await sleep(10);
  }

  return null;
}

// 브루트포스
async function crackBruteforce(chars, maxLen, modeName) {
  log(`\n[단계] ${modeName} 조합 시도 중 (최대 ${maxLen}자리)...`, "log-info");

  for (let length = 1; length <= maxLen; length++) {
    if (shouldStop) return null;

    const total = Math.pow(chars.length, length);
    log(
      `  -> ${length}자리 시도 중... (가능 조합: ${total.toLocaleString()}개)`,
    );

    const result = await bruteforceLength(chars, length, total);
    if (result) return result;
  }

  return null;
}

// 특정 길이 브루트포스
async function bruteforceLength(chars, length, total) {
  let tested = 0;
  const batchSize = 100; // UI 업데이트를 위한 배치 크기

  const generator = generateCombinations(chars, length);
  let batch = [];

  for (const pwd of generator) {
    if (shouldStop) return null;

    batch.push(pwd);
    tested++;

    if (batch.length >= batchSize) {
      // 배치 테스트
      for (const p of batch) {
        const result = await window.electronAPI.testPassword(
          currentFilePath,
          p,
        );
        if (result.success) {
          return p;
        }
      }
      batch = [];

      // 진행 상황 업데이트
      const percent = (tested / total) * 100;
      updateProgress(
        percent,
        `${length}자리: ${tested.toLocaleString()}/${total.toLocaleString()} (${percent.toFixed(1)}%)`,
      );

      await sleep(0); // UI 업데이트 허용
    }
  }

  // 남은 배치 처리
  for (const p of batch) {
    const result = await window.electronAPI.testPassword(currentFilePath, p);
    if (result.success) {
      return p;
    }
  }

  return null;
}

// 조합 생성기
function* generateCombinations(chars, length) {
  const indices = new Array(length).fill(0);
  const charsLen = chars.length;

  while (true) {
    yield indices.map((i) => chars[i]).join("");

    // 인덱스 증가
    let pos = length - 1;
    while (pos >= 0) {
      indices[pos]++;
      if (indices[pos] < charsLen) {
        break;
      }
      indices[pos] = 0;
      pos--;
    }

    if (pos < 0) break;
  }
}

// 유틸리티
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
