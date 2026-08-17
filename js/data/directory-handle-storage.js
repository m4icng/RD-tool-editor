const DIRECTORY_HANDLE_DB = "railwaydash-folder-file";
const DIRECTORY_HANDLE_STORE = "handles";
const LAST_DATA_FOLDER_KEY = "lastDataFolder";

function openDirectoryHandleDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB không khả dụng."));
      return;
    }
    const request = indexedDB.open(DIRECTORY_HANDLE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DIRECTORY_HANDLE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Không thể mở IndexedDB."));
  });
}

function runDirectoryHandleTransaction(mode, action) {
  return openDirectoryHandleDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(DIRECTORY_HANDLE_STORE, mode);
    const store = transaction.objectStore(DIRECTORY_HANDLE_STORE);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB transaction lỗi."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("IndexedDB transaction lỗi."));
    };
  }));
}

export function saveDirectoryHandle(handle) {
  return runDirectoryHandleTransaction("readwrite", (store) => store.put(handle, LAST_DATA_FOLDER_KEY));
}

export function getDirectoryHandle() {
  return runDirectoryHandleTransaction("readonly", (store) => store.get(LAST_DATA_FOLDER_KEY));
}

export function clearDirectoryHandle() {
  return runDirectoryHandleTransaction("readwrite", (store) => store.delete(LAST_DATA_FOLDER_KEY));
}
