// Lightweight, library-free toast - appends a styled element to <body> and
// animates it. Matches the prototype's behaviour. Client-only.
export function toast(message: string, ms = 2400) {
  if (typeof document === "undefined") return;
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("on"));
  setTimeout(() => {
    t.classList.remove("on");
    setTimeout(() => t.remove(), 250);
  }, ms);
}
