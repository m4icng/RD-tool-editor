let timer;

export function showNotification(element, message) {
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => element.classList.remove("show"), 1800);
}
