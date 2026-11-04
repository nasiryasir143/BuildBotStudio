(() => {
  const storageKey = "buildbotstudio.access-key";
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers || {});
    const accessKey = sessionStorage.getItem(storageKey) || "";
    if (accessKey) headers.set("x-app-access-key", accessKey);
    return nativeFetch(input, { ...init, headers });
  };

  document.addEventListener("DOMContentLoaded", () => {
    const shell = document.querySelector("main.shell");
    if (!shell) return;
    const panel = document.createElement("section");
    panel.className = "panel";
    const heading = document.createElement("label");
    heading.htmlFor = "ownerAccessKey";
    heading.textContent = "Owner access key";
    const row = document.createElement("div");
    row.className = "row";
    const input = document.createElement("input");
    input.id = "ownerAccessKey";
    input.type = "password";
    input.autocomplete = "current-password";
    input.maxLength = 256;
    input.placeholder = "Enter the key configured by the owner";
    input.style.flex = "1";
    input.style.minWidth = "180px";
    input.value = sessionStorage.getItem(storageKey) || "";
    const button = document.createElement("button");
    button.className = "secondary";
    button.textContent = "Unlock workspace";
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "The owner must first add the APP_ACCESS_KEY secret in Cloudflare Worker settings. This key stays only in this browser session.";
    const status = document.createElement("p");
    status.className = "hint";
    status.setAttribute("role", "status");
    button.addEventListener("click", () => {
      const value = input.value.trim();
      if (!value) {
        sessionStorage.removeItem(storageKey);
        status.textContent = "Access key cleared for this session.";
        return;
      }
      sessionStorage.setItem(storageKey, value);
      status.textContent = "Access key saved for this browser session.";
    });
    row.append(input, button);
    panel.append(heading, row, note, status);
    const firstPanel = shell.querySelector(".panel");
    shell.insertBefore(panel, firstPanel || shell.firstChild);
  });
})();