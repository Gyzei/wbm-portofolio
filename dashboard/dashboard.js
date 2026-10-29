document.documentElement.removeAttribute("data-theme");
// Retain the page position through editor navigation and native dialog focus restoration.
let editorReturnPosition = null;
try {
  const saved = JSON.parse(sessionStorage.getItem("dashboard-editor-scroll") || "null");
  sessionStorage.removeItem("dashboard-editor-scroll");
  if (saved?.path === location.pathname && new URLSearchParams(location.search).get("page") === "projects") editorReturnPosition = saved;
} catch {}
function rememberEditorScroll(event) {
  const link = event.target.closest('a[href]');
  const row = event.target.closest('.project-row');
  if (!link && row && event.target.closest("button")) return;
  const url = link?.href || row?.dataset.editUrl;
  if (!url) return;
  const params = new URL(url, location.href).searchParams;
  if (params.get("page") !== "projects" || !["edit", "highlight_edit", "add", "highlight_slot"].some(key => params.has(key))) return;
  try { sessionStorage.setItem("dashboard-editor-scroll", JSON.stringify({path:location.pathname,x:scrollX,y:scrollY})); } catch {}
}
document.addEventListener("click", rememberEditorScroll, true);
document.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") rememberEditorScroll(event); }, true);
document.querySelectorAll("dialog").forEach(dialog => {
  const nativeShow = dialog.showModal.bind(dialog);
  let position, opener;
  dialog.showModal = () => {
    if (dialog.open) return;
    position = editorReturnPosition || {x:scrollX,y:scrollY};
    editorReturnPosition = null;
    opener = document.activeElement;
    dialog.dispatchEvent(new Event("dialogopening"));
    nativeShow();
    window.scrollTo({left:position.x,top:position.y,behavior:"instant"});
  };
  dialog.addEventListener("close", () => {
    if (!position) return;
    const savedPosition = position;
    requestAnimationFrame(() => {
      if (opener?.isConnected && !opener.closest("dialog:not([open])")) opener.focus({preventScroll:true});
      window.scrollTo({left:savedPosition.x,top:savedPosition.y,behavior:"instant"});
    });
  });
});
document.querySelectorAll(".media-confirm-delete").forEach(button => button.addEventListener("click", () => {
  document.getElementById("delete-media-id").value = button.dataset.mediaId;
  document.getElementById("delete-media-name").textContent = button.dataset.mediaName;
  document.getElementById("media-delete-dialog").showModal();
}));
const mobileNavTrigger = document.querySelector(".mobile-nav-trigger");
const mobileNavOverlay = document.querySelector(".mobile-nav-overlay");
const mobileNavClose = document.querySelector(".mobile-nav-close");
const mobileSidebar = document.getElementById("sidebar");
const mobileBreakpoint = matchMedia("(max-width:760px)");
if (mobileNavTrigger && mobileSidebar) {
  function setMobileNav(open, restoreFocus = false) {
    document.body.classList.toggle("mobile-nav-open", open);
    mobileNavTrigger.setAttribute("aria-expanded", String(open));
    mobileNavOverlay.hidden = !open;
    mobileSidebar.inert = mobileBreakpoint.matches && !open;
    if (open) mobileNavClose.focus();
    else if (restoreFocus) mobileNavTrigger.focus();
  }
  mobileNavTrigger.addEventListener("click", () => setMobileNav(true));
  mobileNavClose.addEventListener("click", () => setMobileNav(false, true));
  mobileNavOverlay.addEventListener("click", () => setMobileNav(false, true));
  document.addEventListener("keydown", event => {
    if (!document.body.classList.contains("mobile-nav-open")) return;
    if (event.key === "Escape") setMobileNav(false, true);
    if (event.key === "Tab") {
      const links = [...mobileSidebar.querySelectorAll("button, a[href]")];
      const first = links[0], last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  mobileBreakpoint.addEventListener("change", () => setMobileNav(false));
  setMobileNav(false);
}
document.querySelectorAll(".media-rename").forEach(button => button.addEventListener("click", () => {
  const dialog = document.getElementById("media-rename-dialog");
  const name = document.getElementById("rename-media-name");
  document.getElementById("rename-media-id").value = button.dataset.mediaId;
  name.value = button.dataset.mediaName;
  document.getElementById("rename-media-extension").textContent = button.dataset.mediaExtension.toUpperCase();
  dialog.showModal();
  name.focus();
  name.select();
}));
const accountTrigger = document.getElementById("account-trigger");
const accountDropdown = document.getElementById("account-dropdown");
if (accountTrigger && accountDropdown) {
  const closeAccountMenu = () => { accountDropdown.hidden = true; accountTrigger.setAttribute("aria-expanded", "false"); };
  accountTrigger.addEventListener("click", () => { accountDropdown.hidden = !accountDropdown.hidden; accountTrigger.setAttribute("aria-expanded", String(!accountDropdown.hidden)); });
  document.addEventListener("click", (event) => { if (!event.target.closest(".account-menu")) closeAccountMenu(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !accountDropdown.hidden) { closeAccountMenu(); accountTrigger.focus(); } });
}

const sidebarIcons = {
  interactive: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="6" height="7" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/><path d="M9 11h3V5.5h4M12 11v7.5h4"/></svg>',
  projects: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/></svg>',
  slides: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 15 3-3 2.5 2.5L16 10l3 5"/><circle cx="8.5" cy="8.5" r="1"/></svg>',
  media: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h7l2 2h9v10H3z"/><path d="M3 7V5h7l2 2"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6"/></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c.6-4 2.6-6 6-6s5.4 2 6 6M16 5.5a3 3 0 0 1 0 5.5M17 14c2.3.5 3.6 2.5 4 5"/></svg>',
};
document.querySelectorAll(".sidebar .nav a").forEach((link) => {
  const menu = new URL(link.href, location.href).searchParams.get("page");
  if (sidebarIcons[menu]) link.insertAdjacentHTML("afterbegin", sidebarIcons[menu]);
});

document.querySelectorAll("[data-dialog]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.dialog)?.showModal()));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));

document.querySelectorAll(".project-row").forEach((row) => {
  const openEditor = () => { location.href = row.dataset.editUrl; };
  if (!row.hasAttribute("onclick")) row.addEventListener("click", openEditor);
  if (!row.hasAttribute("onkeydown")) row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEditor(); } });
});
const highlightSortable = document.getElementById("highlight-sortable");
if (highlightSortable) {
  let draggedRow = null;
  let reorderMode = false;
  const reorderToggle = document.getElementById("toggle-highlight-reorder");
  const reorderHelp = document.getElementById("highlight-reorder-help");
  const highlightPanel = highlightSortable.closest(".highlights-panel");
  const orderInput = document.getElementById("slide-order-ids");
  const saveOrderButton = document.getElementById("save-highlight-order");
  const initialOrder = [...highlightSortable.querySelectorAll("tr[data-slide-id]")].map(row => row.dataset.slideId).join(",");
  const syncOrder = () => {
    const rows = [...highlightSortable.querySelectorAll("tr[data-slide-id]")];
    orderInput.value = rows.map((row) => row.dataset.slideId).join(",");
    rows.forEach((row, index) => { const tag = row.querySelector(".tag.live"); if (tag) tag.textContent = `#${index + 1}`; });
    const dirty = orderInput.value !== initialOrder;
    saveOrderButton.disabled = false;
    document.getElementById("highlight-order-form").dataset.dirty = String(dirty);
  };
  document.getElementById("highlight-order-form").addEventListener("submit", event => {
    syncOrder();
    if (orderInput.value === initialOrder) { event.preventDefault(); setReorderMode(false); }
    else { saveOrderButton.disabled = true; saveOrderButton.querySelector("span").textContent = "Saving…"; }
  });
  syncOrder();
  function setReorderMode(active) {
    reorderMode = active;
    reorderToggle.setAttribute("aria-pressed", String(reorderMode));
    reorderToggle.hidden = reorderMode;
    highlightPanel.classList.toggle("reorder-mode", reorderMode);
    saveOrderButton.hidden = !reorderMode;
    reorderHelp.hidden = !reorderMode;
    highlightSortable.querySelectorAll("tr[data-slide-id]").forEach(row => { row.draggable = reorderMode; });
    highlightSortable.querySelectorAll(".row-actions button, .row-actions a").forEach(control => {
      if (control.tagName === "BUTTON") control.disabled = reorderMode;
      else {
        if (reorderMode) {
          control.dataset.reorderTabindex = control.getAttribute("tabindex") ?? "";
          control.setAttribute("tabindex", "-1");
          control.setAttribute("aria-disabled", "true");
        } else {
          control.removeAttribute("aria-disabled");
          const tabindex = control.dataset.reorderTabindex;
          if (tabindex) control.setAttribute("tabindex", tabindex);
          else control.removeAttribute("tabindex");
          delete control.dataset.reorderTabindex;
        }
      }
    });
    syncOrder();
  }
  highlightSortable.addEventListener("click", event => {
    if (reorderMode && event.target.closest(".row-actions")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  reorderToggle.addEventListener("click", () => setReorderMode(true));
  highlightSortable.addEventListener("dragstart", (event) => {
    if (!reorderMode) { event.preventDefault(); return; }
    draggedRow = event.target.closest("tr[data-slide-id]");
    if (!draggedRow) { event.preventDefault(); return; }
    window.highlightDragClickBlocked = true;
    draggedRow?.classList.add("dragging");
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", draggedRow.dataset.slideId); }
  });
  highlightSortable.addEventListener("dragover", (event) => {
    if (!reorderMode) return;
    event.preventDefault();
    const target = event.target.closest("tr");
    if (!draggedRow || !target || !target.dataset.slideId || target === draggedRow) return;
    const rect = target.getBoundingClientRect();
    const horizontal = getComputedStyle(highlightSortable).display === "grid";
    const draggedRect = draggedRow.getBoundingClientRect();
    const sameLine = Math.abs(draggedRect.top - rect.top) < rect.height / 2;
    const after = horizontal && sameLine ? event.clientX > rect.left + rect.width / 2 : event.clientY > rect.top + rect.height / 2;
    highlightSortable.insertBefore(draggedRow, after ? target.nextSibling : target);
  });
  highlightSortable.addEventListener("drop", (event) => { if (!reorderMode) return; event.preventDefault(); syncOrder(); });
  highlightSortable.addEventListener("dragend", () => {
    draggedRow?.classList.remove("dragging");
    draggedRow = null;
    syncOrder();
    setTimeout(() => { window.highlightDragClickBlocked = false; }, 0);
  });
  let touchDrag = null;
  highlightSortable.addEventListener("pointerdown", event => {
    if (!reorderMode || event.pointerType === "mouse" || !event.target.closest(".drag-handle")) return;
    const row = event.target.closest("tr[data-slide-id]");
    if (!row) return;
    event.preventDefault();
    touchDrag = {row, id:event.pointerId};
    row.classList.add("dragging");
  });
  document.addEventListener("pointermove", event => {
    if (!touchDrag || event.pointerId !== touchDrag.id) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("tr[data-slide-id]");
    if (!target || !highlightSortable.contains(target) || target === touchDrag.row) return;
    const rect = target.getBoundingClientRect();
    const draggedRect = touchDrag.row.getBoundingClientRect();
    const sameLine = Math.abs(draggedRect.top - rect.top) < rect.height / 2;
    const after = sameLine ? event.clientX > rect.left + rect.width / 2 : event.clientY > rect.top + rect.height / 2;
    highlightSortable.insertBefore(touchDrag.row, after ? target.nextSibling : target);
    syncOrder();
  }, {passive:false});
  function endTouchDrag(event) {
    if (!touchDrag || event.pointerId !== touchDrag.id) return;
    touchDrag.row.classList.remove("dragging");
    touchDrag = null;
    syncOrder();
  }
  document.addEventListener("pointerup", endTouchDrag);
  document.addEventListener("pointercancel", endTouchDrag);
}

const deleteProjectButton = document.getElementById("delete-project");
const projectDeleteDialog = document.getElementById("project-delete-dialog");
const projectDeleteInput = document.getElementById("confirm-project-delete-name");
const confirmProjectDelete = document.getElementById("confirm-project-delete");
const copyProjectDeleteName = document.getElementById("copy-project-delete-name");
if (deleteProjectButton && projectDeleteDialog) {
  const projectName = copyProjectDeleteName.querySelector("span").textContent.trim();
  deleteProjectButton.addEventListener("click", () => { projectDeleteInput.value = ""; confirmProjectDelete.disabled = true; projectDeleteDialog.showModal(); });
  projectDeleteInput.addEventListener("input", () => { confirmProjectDelete.disabled = projectDeleteInput.value.trim() !== projectName; });
  copyProjectDeleteName.addEventListener("click", async () => { try { await navigator.clipboard.writeText(projectName); } catch {} });
  confirmProjectDelete.addEventListener("click", () => { if (projectDeleteInput.value.trim() === projectName) document.getElementById("delete-project-form").submit(); });
}

const projectListDeleteDialog = document.getElementById("project-list-delete-dialog");
const projectListDeleteInput = document.getElementById("confirm-project-list-delete-name");
const projectListDeleteLabel = document.getElementById("project-list-delete-label");
const projectListDeleteId = document.getElementById("delete-project-list-id");
const confirmProjectListDelete = document.getElementById("confirm-project-list-delete");
const copyProjectListDeleteName = document.getElementById("copy-project-list-delete-name");
let pendingProjectListDeleteName = "";
document.querySelectorAll(".project-list-delete").forEach((button) => button.addEventListener("click", (event) => {
  event.stopPropagation();
  pendingProjectListDeleteName = button.dataset.projectName;
  projectListDeleteId.value = button.dataset.projectId;
  projectListDeleteLabel.textContent = pendingProjectListDeleteName;
  projectListDeleteInput.value = "";
  confirmProjectListDelete.disabled = true;
  projectListDeleteDialog.showModal();
}));
if (projectListDeleteDialog) {
  projectListDeleteInput.addEventListener("input", () => { confirmProjectListDelete.disabled = projectListDeleteInput.value.trim() !== pendingProjectListDeleteName; });
  copyProjectListDeleteName.addEventListener("click", async () => { try { await navigator.clipboard.writeText(pendingProjectListDeleteName); } catch {} });
  confirmProjectListDelete.addEventListener("click", () => { if (projectListDeleteInput.value.trim() === pendingProjectListDeleteName) document.getElementById("delete-project-list-form").submit(); });
}

const deleteHighlightButton = document.getElementById("delete-highlight");
const highlightDeleteDialog = document.getElementById("highlight-delete-dialog");
const highlightDeleteInput = document.getElementById("confirm-highlight-delete-name");
const confirmHighlightDelete = document.getElementById("confirm-highlight-delete");
const copyHighlightDeleteName = document.getElementById("copy-highlight-delete-name");
if (deleteHighlightButton && highlightDeleteDialog) {
  const highlightName = copyHighlightDeleteName.querySelector("span").textContent.trim();
  deleteHighlightButton.addEventListener("click", () => { highlightDeleteInput.value = ""; confirmHighlightDelete.disabled = true; highlightDeleteDialog.showModal(); });
  highlightDeleteInput.addEventListener("input", () => { confirmHighlightDelete.disabled = highlightDeleteInput.value.trim() !== highlightName; });
  copyHighlightDeleteName.addEventListener("click", async () => { try { await navigator.clipboard.writeText(highlightName); } catch {} });
  confirmHighlightDelete.addEventListener("click", () => { if (highlightDeleteInput.value.trim() === highlightName) document.getElementById("delete-highlight-form").submit(); });
}

const highlightListDeleteDialog = document.getElementById("highlight-list-delete-dialog");
const highlightListDeleteInput = document.getElementById("confirm-highlight-list-delete-name");
const highlightListDeleteLabel = document.getElementById("highlight-list-delete-label");
const highlightListDeleteId = document.getElementById("delete-highlight-list-id");
const confirmHighlightListDelete = document.getElementById("confirm-highlight-list-delete");
const copyHighlightListDeleteName = document.getElementById("copy-highlight-list-delete-name");
let pendingHighlightListDeleteName = "";
document.querySelectorAll(".highlight-list-delete").forEach((button) => button.addEventListener("click", (event) => {
  event.stopPropagation();
  pendingHighlightListDeleteName = button.dataset.highlightName;
  highlightListDeleteId.value = button.dataset.highlightId;
  highlightListDeleteLabel.textContent = pendingHighlightListDeleteName;
  highlightListDeleteInput.value = "";
  confirmHighlightListDelete.disabled = true;
  highlightListDeleteDialog.showModal();
}));
if (highlightListDeleteDialog) {
  highlightListDeleteInput.addEventListener("input", () => { confirmHighlightListDelete.disabled = highlightListDeleteInput.value.trim() !== pendingHighlightListDeleteName; });
  copyHighlightListDeleteName.addEventListener("click", async () => { try { await navigator.clipboard.writeText(pendingHighlightListDeleteName); } catch {} });
  confirmHighlightListDelete.addEventListener("click", () => { if (highlightListDeleteInput.value.trim() === pendingHighlightListDeleteName) document.getElementById("delete-highlight-list-form").submit(); });
}

function initSearchableProjectSelect() {
  const select = document.getElementById("highlight-project-select");
  if (!select) return;
  const options = [...select.options].filter((option) => option.value);
  const control = document.createElement("div");
  control.className = "searchable-select";
  control.innerHTML = '<div class="searchable-select-input"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg><input type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" placeholder="Search and select project..." autocomplete="off"><button type="button" aria-label="Open project list"><svg viewBox="0 0 24 24"><path d="m7 9 5 5 5-5"></path></svg></button></div><div class="searchable-select-menu" role="listbox" hidden></div>';
  select.hidden = true;
  select.insertAdjacentElement("afterend", control);
  const input = control.querySelector("input");
  const toggle = control.querySelector("button");
  const menu = control.querySelector(".searchable-select-menu");
  let activeIndex = -1;

  const selected = options.find((option) => option.selected);
  if (selected) input.value = selected.textContent.trim();
  function close() { menu.hidden = true; input.setAttribute("aria-expanded", "false"); activeIndex = -1; }
  function open() { const currentOption = options.find((option) => option.value === select.value); menu.hidden = false; input.setAttribute("aria-expanded", "true"); render(input.value === currentOption?.textContent.trim() ? "" : input.value); }
  function choose(option) { select.value = option.value; input.value = option.textContent.trim(); select.dispatchEvent(new Event("change", { bubbles: true })); close(); }
  function render(query = "") {
    const matches = options.filter((option) => option.textContent.toLowerCase().includes(query.trim().toLowerCase()));
    menu.innerHTML = "";
    matches.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "option";
      button.dataset.value = option.value;
      button.className = option.value === select.value ? "selected" : "";
      const parts = option.textContent.split("—");
      button.innerHTML = `<span>${parts[0].trim()}</span><small>${(parts[1] || "Portfolio project").trim()}</small>`;
      button.addEventListener("mousedown", (event) => { event.preventDefault(); choose(option); });
      menu.append(button);
    });
    if (!matches.length) menu.innerHTML = '<p class="searchable-select-empty">No matching projects</p>';
    activeIndex = -1;
  }
  input.addEventListener("focus", open);
  input.addEventListener("input", () => { if (menu.hidden) open(); else render(input.value); });
  toggle.addEventListener("click", () => { if (menu.hidden) { input.focus(); open(); } else close(); });
  input.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll("[role=option]")];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); activeIndex = event.key === "ArrowDown" ? Math.min(activeIndex + 1, items.length - 1) : Math.max(activeIndex - 1, 0); items.forEach((item, index) => item.classList.toggle("active", index === activeIndex)); items[activeIndex]?.scrollIntoView({ block: "nearest" }); }
    if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); const option = options.find((item) => item.value === items[activeIndex].dataset.value); if (option) choose(option); }
    if (event.key === "Escape") close();
  });
  document.addEventListener("click", (event) => { if (!control.contains(event.target)) close(); });
}
initSearchableProjectSelect();

function initSearchableMediaSelect(selectId, placeholder) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const options = [...select.options];
  const control = document.createElement("div");
  control.className = "searchable-select searchable-media-select";
  control.innerHTML = '<div class="searchable-select-input"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg><input type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off"><button type="button" aria-label="Open image list"><svg viewBox="0 0 24 24"><path d="m7 9 5 5 5-5"></path></svg></button></div><div class="searchable-select-menu" role="listbox" hidden></div>';
  select.hidden = true;
  select.insertAdjacentElement("afterend", control);
  const picker = document.createElement("div");
  picker.className = "media-picker-row";
  picker.style.setProperty("height", "42px", "important");
  picker.style.setProperty("min-height", "42px", "important");
  picker.style.setProperty("max-height", "42px", "important");
  const preview = document.createElement("div");
  preview.className = "media-picker-preview";
  preview.style.setProperty("width", "58px", "important");
  preview.style.setProperty("position", "relative", "important");
  preview.style.setProperty("display", "block", "important");
  preview.style.setProperty("box-sizing", "border-box", "important");
  preview.style.setProperty("height", "42px", "important");
  preview.style.setProperty("min-height", "42px", "important");
  preview.style.setProperty("max-height", "42px", "important");
  preview.style.setProperty("aspect-ratio", "auto", "important");
  preview.style.setProperty("overflow", "hidden", "important");
  const previewImage = document.createElement("img");
  previewImage.alt = "Selected image preview";
  const previewEmpty = document.createElement("div");
  previewEmpty.className = "media-picker-preview-empty";
  previewEmpty.setAttribute("aria-hidden", "true");
  previewEmpty.style.setProperty("position", "absolute", "important");
  previewEmpty.style.setProperty("inset", "0", "important");
  previewEmpty.style.setProperty("width", "100%", "important");
  previewEmpty.style.setProperty("height", "42px", "important");
  previewEmpty.style.setProperty("min-height", "42px", "important");
  previewEmpty.style.setProperty("max-height", "42px", "important");
  previewEmpty.style.setProperty("box-sizing", "border-box", "important");
  previewEmpty.style.setProperty("overflow", "hidden", "important");
  previewEmpty.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="8.5" cy="9" r="1.5"></circle><path d="m4 17 5-5 4 4 2-2 5 5"></path></svg>';
  control.before(picker);
  picker.append(preview, control);
  preview.append(previewImage, previewEmpty);
  const input = control.querySelector("input");
  const toggle = control.querySelector("button");
  const menu = control.querySelector(".searchable-select-menu");
  const inputShell = control.querySelector(".searchable-select-input");
  function syncPreviewHeight() {
    const fieldHeight = Math.round(inputShell.getBoundingClientRect().height);
    if (!fieldHeight) return;
    const height = `${fieldHeight}px`;
    picker.style.setProperty("height", height, "important");
    picker.style.setProperty("min-height", height, "important");
    picker.style.setProperty("max-height", height, "important");
    preview.style.setProperty("height", height, "important");
    preview.style.setProperty("min-height", height, "important");
    preview.style.setProperty("max-height", height, "important");
    preview.style.setProperty("block-size", height, "important");
    previewEmpty.style.setProperty("height", height, "important");
    previewEmpty.style.setProperty("min-height", height, "important");
    previewEmpty.style.setProperty("max-height", height, "important");
  }
  requestAnimationFrame(syncPreviewHeight);
  if ("ResizeObserver" in window) new ResizeObserver(syncPreviewHeight).observe(inputShell);
  input.placeholder = placeholder;
  const selected = options.find((option) => option.selected);
  input.value = selected?.value ? selected.textContent.trim() : "";
  function updatePreview(value) {
    const hasImage = Boolean(value);
    preview.classList.toggle("is-empty", !hasImage);
    previewImage.hidden = !hasImage;
    previewEmpty.hidden = hasImage;
    if (hasImage) previewImage.src = value;
    else previewImage.removeAttribute("src");
  }
  updatePreview(select.value);
  function close() { menu.hidden = true; input.setAttribute("aria-expanded", "false"); }
  function choose(option) { select.value = option.value; input.value = option.value ? option.textContent.trim() : ""; updatePreview(option.value); select.dispatchEvent(new Event("change", { bubbles: true })); close(); }
  function addOption(option) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "option");
    button.className = `media-option${option.value === select.value ? " selected" : ""}`;
    const content = document.createElement("span");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    if (option.value) {
      const image = document.createElement("img");
      image.src = option.value;
      image.alt = "";
      button.append(image);
      title.textContent = option.textContent.trim();
      meta.textContent = "Image from Media Library";
    } else {
      content.className = "media-option-empty";
      title.textContent = "No image";
      meta.textContent = "Remove the current selection";
    }
    content.append(title, meta);
    button.append(content);
    button.addEventListener("mousedown", (event) => { event.preventDefault(); choose(option); });
    menu.append(button);
  }
  function render(query = "") {
    const normalized = query.trim().toLowerCase();
    const matches = options.filter((option) => !option.value || option.textContent.toLowerCase().includes(normalized));
    menu.replaceChildren();
    matches.forEach(addOption);
    if (!matches.length) { const empty = document.createElement("p"); empty.className = "searchable-select-empty"; empty.textContent = "No matching images"; menu.append(empty); }
  }
  function open() { const current = options.find((option) => option.value === select.value); menu.hidden = false; input.setAttribute("aria-expanded", "true"); render(input.value === current?.textContent.trim() ? "" : input.value); }
  input.addEventListener("focus", open);
  input.addEventListener("input", () => { if (menu.hidden) open(); else render(input.value); });
  input.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); if (event.key === "Enter") { const first = menu.querySelector(".media-option"); if (first) { event.preventDefault(); first.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); } } });
  toggle.addEventListener("click", () => { if (menu.hidden) { input.focus(); open(); } else close(); });
  select.addEventListener("change", () => updatePreview(select.value));
  document.addEventListener("click", (event) => { if (!control.contains(event.target)) close(); });
}

function buildMediaBrowser() {
  const gallery = document.querySelector(".media-grid");
  if (!gallery) return;
  gallery.classList.remove("media-grid");
  gallery.classList.add("media-gallery");
  const cards = [...gallery.querySelectorAll(".media-card")];
  cards.forEach((card) => {
    const preview = card.querySelector("img, .file-icon");
    const name = card.querySelector("strong");
    const path = card.querySelector("small");
    const form = card.querySelector("form");
    const type = name?.textContent.split(".").pop()?.toUpperCase() || "FILE";
    const previewBox = document.createElement("div");
    previewBox.className = "media-preview";
    if (preview) previewBox.append(preview);
    const body = document.createElement("div");
    body.className = "media-card-body";
    const fileName = document.createElement("p");
    fileName.className = "media-name";
    fileName.textContent = name?.textContent || "File";
    fileName.title = fileName.textContent;
    const meta = document.createElement("p");
    meta.className = "media-meta";
    meta.textContent = `${type} · ${path?.textContent || "Local file"}`;
    const actions = document.createElement("div");
    actions.className = "media-actions";
    if (form) {
      const button = form.querySelector("button");
      button.className = "media-delete";
      button.title = "Delete";
      button.setAttribute("aria-label", `Delete ${fileName.textContent}`);
      button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 14h10l1-14"/></svg>';
      button.onclick = () => confirm(`Hapus ${fileName.textContent}?`);
      actions.append(form);
    }
    card.replaceChildren(previewBox, body);
    body.append(fileName, meta, actions);
  });

  if (!cards.length) gallery.innerHTML = '<p class="media-empty">No files uploaded yet.</p>';
  const stats = document.createElement("div");
  stats.className = "stats media-stats";
  stats.innerHTML = `<div class="stat"><span>Total files</span><strong>${cards.length}</strong></div><div class="stat"><span>Storage</span><strong>Local</strong></div>`;
  const tools = document.createElement("div");
  tools.className = "media-tools";
  tools.innerHTML = '<label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg><input type="search" placeholder="Search media..." aria-label="Search media"></label><div class="media-view-actions"><div class="view-toggle"><button class="active" type="button" data-view="grid" title="Grid view"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6"></rect><rect x="14" y="4" width="6" height="6"></rect><rect x="4" y="14" width="6" height="6"></rect><rect x="14" y="14" width="6" height="6"></rect></svg></button><button type="button" data-view="list" title="List view"><svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12"></path><circle cx="4" cy="6" r=".8"></circle><circle cx="4" cy="12" r=".8"></circle><circle cx="4" cy="18" r=".8"></circle></svg></button></div></div>';
  gallery.before(stats, tools);
  const pagination = document.createElement("div");
  pagination.className = "pagination media-pagination";
  pagination.innerHTML = '<span class="page-info"></span><div class="page-actions"><button type="button">&laquo;</button><button type="button">&larr;</button><button class="current" type="button">1</button><button type="button">&rarr;</button><button type="button">&raquo;</button></div>';
  gallery.after(pagination);
  const buttons = [...pagination.querySelectorAll("button")];
  let page = 1;
  let query = "";
  const pageSize = 8;
  function render() {
    const filtered = cards.filter((card) => card.textContent.toLowerCase().includes(query));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.max(1, Math.min(page, pages));
    cards.forEach((card) => (card.hidden = true));
    filtered.slice((page - 1) * pageSize, page * pageSize).forEach((card) => (card.hidden = false));
    const first = filtered.length ? (page - 1) * pageSize + 1 : 0;
    pagination.querySelector(".page-info").textContent = `Showing ${first}-${Math.min(page * pageSize, filtered.length)} of ${filtered.length} files`;
    buttons[2].textContent = page;
    buttons[0].disabled = buttons[1].disabled = page === 1;
    buttons[3].disabled = buttons[4].disabled = page === pages;
  }
  tools.querySelector("input").addEventListener("input", (event) => { query = event.target.value.trim().toLowerCase(); page = 1; render(); });
  tools.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    tools.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
    gallery.classList.toggle("list-view", button.dataset.view === "list");
  }));
  buttons[0].onclick = () => { page = 1; render(); };
  buttons[1].onclick = () => { page--; render(); };
  buttons[3].onclick = () => { page++; render(); };
  buttons[4].onclick = () => { page = Math.max(1, Math.ceil(cards.filter((card) => card.textContent.toLowerCase().includes(query)).length / pageSize)); render(); };
  render();
}

function enhanceFilterDropdown(select) {
  const wrapper = document.createElement("div");
  wrapper.className = "filter-dropdown";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "filter-dropdown-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", select.getAttribute("aria-label"));
  const text = document.createElement("span");
  trigger.append(text);
  trigger.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>');
  const menu = document.createElement("div");
  menu.className = "filter-dropdown-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", select.getAttribute("aria-label"));
  menu.hidden = true;
  select.hidden = true;
  // A custom interactive control must not live inside the original label.
  const label = select.parentElement;
  const group = document.createElement("div");
  group.className = "filter-control";
  label.replaceWith(group);
  group.append(...label.childNodes);
  select.after(wrapper);
  wrapper.append(trigger, menu);
  const options = [...select.options].map(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-dropdown-option";
    button.setAttribute("role", "option");
    button.textContent = option.text;
    button.addEventListener("click", () => { select.value = option.value; select.dispatchEvent(new Event("change", {bubbles:true})); close(); trigger.focus(); });
    menu.append(button);
    return {option, button};
  });
  function sync() {
    text.textContent = select.selectedOptions[0]?.text || "";
    options.forEach(({option, button}) => button.setAttribute("aria-selected", String(option.selected)));
  }
  function close() { menu.hidden = true; trigger.setAttribute("aria-expanded", "false"); }
  function open() { menu.hidden = false; trigger.setAttribute("aria-expanded", "true"); options[select.selectedIndex]?.button.focus(); }
  trigger.addEventListener("click", () => menu.hidden ? open() : close());
  trigger.addEventListener("keydown", event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); open(); } });
  menu.addEventListener("keydown", event => {
    const index = options.findIndex(item => item.button === document.activeElement);
    let next;
    if (event.key === "ArrowDown") next = (index + 1) % options.length;
    if (event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = options.length - 1;
    if (next !== undefined) { event.preventDefault(); options[next]?.button.focus(); }
    if (event.key === "Escape") { event.preventDefault(); close(); trigger.focus(); }
  });
  wrapper.addEventListener("focusout", () => { setTimeout(() => { if (!wrapper.contains(document.activeElement)) close(); }, 0); });
  document.addEventListener("click", event => { if (!wrapper.contains(event.target)) close(); });
  select.addEventListener("change", sync);
  sync();
}

function createFilterSorter(container, items, filterKey, filterLabel, onChange) {
  const bar = document.createElement("div");
  bar.className = "filter-sorter";
  bar.innerHTML = '<label><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg><span>Filter</span><select aria-label="Filter"></select></label><label><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16m-3-3 3 3 3-3M16 20V4m-3 3 3-3 3 3"/></svg><span>Sort by</span><select aria-label="Sort by"><option value="created">Added time</option><option value="name">Name</option></select></label><button type="button" class="sort-direction" aria-label="Sort ascending" title="Newest first"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v16m-3-3 3 3 3-3M13 6h8M13 12h6M13 18h4"/></svg></button>';
  const [filter, sort] = bar.querySelectorAll("select");
  filter.add(new Option(filterLabel, ""));
  [...new Set(items.map(item => item.dataset[filterKey]).filter(Boolean))].sort((a,b) => a.localeCompare(b)).forEach(value => filter.add(new Option(value, value)));
  let ascending = false;
  const direction = bar.querySelector("button");
  function update() {
    direction.setAttribute("aria-label", ascending ? "Sort descending" : "Sort ascending");
    direction.title = sort.value === "name" ? (ascending ? "A to Z" : "Z to A") : (ascending ? "Oldest first" : "Newest first");
    direction.classList.toggle("ascending", ascending);
    onChange();
  }
  filter.addEventListener("change", update);
  sort.addEventListener("change", () => { ascending = sort.value === "name"; update(); });
  direction.addEventListener("click", () => { ascending = !ascending; update(); });
  container.append(bar);
  enhanceFilterDropdown(filter);
  enhanceFilterDropdown(sort);
  return {
    matches: item => !filter.value || item.dataset[filterKey] === filter.value,
    compare: (a,b) => {
      const result = sort.value === "name" ? a.dataset.name.localeCompare(b.dataset.name, undefined, {numeric:true,sensitivity:"base"}) : (Date.parse(a.dataset.created) || 0) - (Date.parse(b.dataset.created) || 0);
      return (ascending ? 1 : -1) * (result || Number(a.dataset.id) - Number(b.dataset.id));
    }
  };
}

function initMediaBrowser() {
  const gallery = document.getElementById("media-gallery");
  if (!gallery) return;
  const cards = [...gallery.querySelectorAll(".media-card")];
  const search = document.getElementById("media-search");
  const info = document.getElementById("media-page-info");
  const current = document.getElementById("media-current-page");
  const first = document.querySelector('[data-media-page="first"]');
  const previous = document.querySelector('[data-media-page="prev"]');
  const next = document.querySelector('[data-media-page="next"]');
  const last = document.querySelector('[data-media-page="last"]');
  const pageSize = 8;
  let page = 1;
  let query = "";
  cards.forEach(card => {
    const ext = card.dataset.name.split(".").pop().toLowerCase();
    card.dataset.type = /^(jpg|jpeg|png|gif|svg|webp)$/.test(ext) ? "Images" : /^(mp4|webm|mov)$/.test(ext) ? "Videos" : "Documents";
  });
  const sorting = createFilterSorter(document.querySelector(".media-tools"), cards, "type", "All file types", () => { page = 1; render(); });
  function render() {
    const filtered = cards.filter((card) => card.textContent.toLowerCase().includes(query) && sorting.matches(card)).sort(sorting.compare);
    filtered.forEach(card => gallery.append(card));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.max(1, Math.min(page, pages));
    cards.forEach((card) => (card.hidden = true));
    filtered.slice((page - 1) * pageSize, page * pageSize).forEach((card) => (card.hidden = false));
    const start = filtered.length ? (page - 1) * pageSize + 1 : 0;
    info.textContent = `Showing ${start}-${Math.min(page * pageSize, filtered.length)} of ${filtered.length} files`;
    current.textContent = page;
    first.disabled = previous.disabled = page === 1;
    next.disabled = last.disabled = page === pages;
  }
  search.addEventListener("input", (event) => { query = event.target.value.trim().toLowerCase(); page = 1; render(); });
  document.querySelectorAll("[data-media-view]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-media-view]").forEach((item) => item.classList.toggle("active", item === button));
    gallery.classList.toggle("list-view", button.dataset.mediaView === "list");
  }));
  first.onclick = () => { page = 1; render(); };
  previous.onclick = () => { page--; render(); };
  next.onclick = () => { page++; render(); };
  last.onclick = () => { page = Math.max(1, Math.ceil(cards.filter((card) => card.textContent.toLowerCase().includes(query) && sorting.matches(card)).length / pageSize)); render(); };
  render();
}

function buildProfileTable() {
  if (!location.search.includes("page=profile")) return;
  const fields = document.querySelector(".form-panel .editor-fields");
  if (!fields) return;
  const table = document.createElement("table");
  table.className = "settings-table";
  table.innerHTML = "<thead><tr><th>Profile field</th><th>Value</th></tr></thead><tbody></tbody>";
  [...fields.querySelectorAll(":scope > label")].forEach((label) => {
    const control = label.querySelector("input,select,textarea");
    const labelText = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || "Field";
    const row = table.tBodies[0].insertRow();
    const labelCell = row.insertCell();
    const fieldLabel = document.createElement("strong");
    fieldLabel.textContent = labelText;
    labelCell.append(fieldLabel);
    if (control) row.insertCell().append(control);
  });
  fields.replaceWith(table);
}

function enhanceTable(table) {
  table.classList.add("table", "dashboard-table");
  const body = table.tBodies[0];
  if (!body) return;
  let rows = [...body.rows];
  rows.forEach((row) => row.classList.add("product-row"));
  if (!rows.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = table.tHead?.rows[0]?.cells.length || 1;
    cell.className = "table-empty";
    cell.innerHTML = "<div><span>Belum ada data</span><small>Gunakan tombol tambah di atas untuk membuat data pertama.</small></div>";
  }

  const pageSize = 5;
  let page = 1;
  let query = "";
  const panel = table.closest(".panel");
  let tools = panel?.querySelector(".panel-head, .catalogue-tools");
  if (!tools && panel && !table.classList.contains("settings-table")) {
    tools = document.createElement("div");
    tools.className = "catalogue-tools generated-tools";
    tools.innerHTML = '<label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg><input type="search" placeholder="Search data..."></label><button class="sort-btn" type="button"><span>Sort: Newest</span></button>';
    table.before(tools);
  }
  tools?.classList.add("catalogue-tools");
  const searchInput = tools?.querySelector("input[type=search]");
  if (searchInput && !searchInput.closest(".search")) {
    const search = document.createElement("label");
    search.className = "search";
    search.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg>';
    searchInput.replaceWith(search);
    search.append(searchInput);
  }
  if (table.classList.contains("settings-table")) return;
  if (table.closest(".highlights-panel")) {
    searchInput?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      rows.forEach((row) => (row.hidden = !row.textContent.toLowerCase().includes(query)));
    });
    return;
  }

  const pagination = document.createElement("div");
  pagination.className = "pagination";
  pagination.innerHTML = '<span class="page-info"></span><div class="page-actions"><button type="button">&laquo;</button><button type="button">&larr;</button><button class="current" type="button">1</button><button type="button">&rarr;</button><button type="button">&raquo;</button></div>';
  table.after(pagination);
  const buttons = [...pagination.querySelectorAll("button")];
  const isProjects = !!table.closest(".projects-panel");
  rows.forEach(row => {
    if (!isProjects) return;
    row.dataset.name = row.querySelector(".product strong")?.textContent.trim() || "";
    row.dataset.category = row.querySelector(".category-tag")?.textContent.trim() || "";
    row.dataset.created = row.cells[2]?.dataset.created || "";
    row.dataset.id = new URL(row.dataset.editUrl, location.href).searchParams.get("edit");
  });
  if (isProjects) tools.querySelector(".sort-btn")?.remove();
  const sorting = isProjects ? createFilterSorter(tools, rows, "category", "All categories", () => { page = 1; render(); }) : null;
  function render() {
    const visible = rows.filter((row) => row.textContent.toLowerCase().includes(query) && (!sorting || sorting.matches(row)));
    if (sorting) { visible.sort(sorting.compare); visible.forEach(row => body.append(row)); }
    const pages = Math.max(1, Math.ceil(visible.length / pageSize));
    page = Math.max(1, Math.min(page, pages));
    rows.forEach((row) => (row.hidden = true));
    visible.slice((page - 1) * pageSize, page * pageSize).forEach((row) => (row.hidden = false));
    const first = visible.length ? (page - 1) * pageSize + 1 : 0;
    pagination.querySelector(".page-info").textContent = `Showing ${first}-${Math.min(page * pageSize, visible.length)} of ${visible.length} entries`;
    buttons[2].textContent = page;
    buttons[0].disabled = buttons[1].disabled = page === 1;
    buttons[3].disabled = buttons[4].disabled = page === pages;
  }
  searchInput?.addEventListener("input", (event) => { query = event.target.value.trim().toLowerCase(); page = 1; render(); });
  buttons[0].onclick = () => { page = 1; render(); };
  buttons[1].onclick = () => { page--; render(); };
  buttons[3].onclick = () => { page++; render(); };
  buttons[4].onclick = () => { page = Math.ceil(rows.filter((row) => row.textContent.toLowerCase().includes(query) && (!sorting || sorting.matches(row))).length / pageSize); render(); };
  render();
}

initMediaBrowser();
buildProfileTable();
initSearchableMediaSelect("project-cover-select", "Search and select cover...");
initSearchableMediaSelect("profile-photo-select", "Search and select avatar...");
function initPublicProfilePreview() {
  const photo = document.getElementById("profile-photo-select");
  const panel = photo?.closest(".form-panel");
  if (!panel) return;
  const layout = document.createElement("div");
  layout.className = "public-profile-layout";
  const preview = document.createElement("aside");
  preview.className = "panel public-profile-preview";
  preview.setAttribute("aria-label", "Public profile preview");
  preview.innerHTML = '<p class="eyebrow">PROFILE PREVIEW</p><div class="public-preview-avatar"><img alt="Profile photo" hidden><span></span></div><h2></h2><p class="public-preview-username"></p><p class="public-preview-bio"></p><div class="public-preview-contact"><p data-contact="email"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg><span></span></p><p data-contact="phone"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 3 4 1 1 5-2 2a14 14 0 0 0 5 5l2-2 5 1 1 4c0 2-2 3-4 2C9 19 5 15 3 7c-1-2 0-4 2-4Z"/></svg><span></span></p></div>';
  panel.before(layout);
  layout.append(preview, panel);
  const form = panel.querySelector("form");
  const value = name => form.elements.namedItem(name)?.value.trim() || "";
  function update() {
    const name = value("name") || "Your name";
    preview.querySelector("h2").textContent = name;
    const username = value("username");
    preview.querySelector(".public-preview-username").textContent = (username ? '@' + username.replace(/^@/, '') + ' • ' : '') + 'Portfolio Owner';
    preview.querySelector(".public-preview-bio").textContent = value("description") || "Bio profil akan tampil di sini.";
    const image = preview.querySelector("img");
    const initial = preview.querySelector(".public-preview-avatar span");
    image.hidden = !photo.value;
    initial.hidden = !!photo.value;
    initial.textContent = [...name][0].toUpperCase();
    if (photo.value && image.getAttribute("src") !== photo.value) image.src = photo.value;
    if (!photo.value) image.removeAttribute("src");
    for (const field of ["email", "phone"]) {
      const contact = preview.querySelector(`[data-contact="${field}"]`);
      contact.querySelector("span").textContent = value(field);
      contact.hidden = !value(field);
    }
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
}
initPublicProfilePreview();
function initDirtySave(form, resetOnOpen = false) {
  if (!form) return;
  const save = form.querySelector("button.primary");
  if (!save) return;
  const fields = [...form.elements].filter(field => field.name && !["hidden", "submit", "button"].includes(field.type));
  const snapshot = () => JSON.stringify(fields.map(field => [field.name, field.type === "file" ? [...field.files].map(file => [file.name, file.size, file.lastModified]) : field.type === "checkbox" || field.type === "radio" ? field.checked : field.type === "password" ? field.value : field.value.trim()]));
  let baseline = snapshot();
  function update() {
    const dirty = snapshot() !== baseline;
    form.dataset.dirty = String(dirty);
    save.disabled = !dirty;
    save.title = dirty ? "Save changes" : "Belum ada perubahan";
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("reset", () => requestAnimationFrame(update));
  form.addEventListener("submit", event => { if (snapshot() === baseline) event.preventDefault(); });
  if (resetOnOpen) form.closest("dialog")?.addEventListener("dialogopening", () => { baseline = snapshot(); update(); });
  update();
}
initDirtySave(document.querySelector("#media-rename-dialog form"), true);
initDirtySave(document.getElementById("profile-photo-select")?.closest("form"));
const dirtyProjectForm = document.getElementById("project-form");
initDirtySave(dirtyProjectForm);
initDirtySave(document.querySelector("#media-modal form"));
const uploadInput = document.getElementById("upload-file");
if (uploadInput) {
  const zone = document.getElementById("upload-dropzone");
  const selection = document.getElementById("upload-selection");
  const error = document.getElementById("upload-error");
  const image = selection.querySelector("img");
  const icon = selection.querySelector("svg");
  let previewUrl;
  function updateUpload() {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    const file = uploadInput.files[0];
    selection.hidden = !file;
    image.hidden = true;
    image.removeAttribute("src");
    icon.hidden = false;
    uploadInput.setCustomValidity("");
    error.hidden = true;
    if (!file) return;
    document.getElementById("upload-file-name").textContent = file.name;
    document.getElementById("upload-file-size").textContent = file.size >= 1048576 ? `${(file.size / 1048576).toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`;
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = uploadInput.accept.split(',').map(value => value.slice(1));
    const message = file.size > 10485760 ? "Ukuran file melebihi 10 MB." : !allowed.includes(ext) ? "Format file tidak didukung." : "";
    error.textContent = message;
    error.hidden = !message;
    uploadInput.setCustomValidity(message);
    if (!message && /^(jpg|jpeg|png|gif|webp)$/.test(ext)) {
      previewUrl = URL.createObjectURL(file);
      image.src = previewUrl;
      image.hidden = false;
      icon.hidden = true;
    }
  }
  uploadInput.addEventListener("change", updateUpload);
  document.getElementById("upload-remove").addEventListener("click", () => { uploadInput.value = ""; uploadInput.dispatchEvent(new Event("change", {bubbles:true})); });
  ["dragenter", "dragover"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add("drag-over"); }));
  zone.addEventListener("dragleave", event => { if (!zone.contains(event.relatedTarget)) zone.classList.remove("drag-over"); });
  zone.addEventListener("drop", event => {
    event.preventDefault(); zone.classList.remove("drag-over");
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    uploadInput.files = transfer.files;
    uploadInput.dispatchEvent(new Event("change", {bubbles:true}));
  });
}
initDirtySave(document.querySelector(".account-settings-panel form"));
const newPassword = document.getElementById("new-password");
if (newPassword) {
  const strength = document.getElementById("password-strength");
  const meter = strength.querySelector('[role="meter"]');
  const label = document.getElementById("password-strength-label");
  const confirm = newPassword.form.elements.namedItem("confirm_password");
  function updatePasswordStrength() {
    const password = newPassword.value;
    const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(password)).length;
    let score = password.length < 8 ? 1 : password.length >= 16 || password.length >= 12 && variety >= 3 ? 4 : password.length >= 10 && variety >= 2 ? 3 : 2;
    if (/^(.)\1+$/.test(password) || /^(password|123456|qwerty|admin|abcdefgh)/i.test(password)) score = 1;
    strength.hidden = !password;
    strength.dataset.level = String(score);
    meter.setAttribute("aria-valuenow", String(password ? score : 0));
    const level = ["", "Lemah", "Cukup", "Baik", "Kuat"][score];
    meter.setAttribute("aria-valuetext", password ? level : "Belum diisi");
    strength.style.setProperty("--strength-width", `${score * 25}%`);
    label.textContent = password ? `${level}${password.length < 8 ? ' — minimal 8 karakter' : ''}` : "";
    confirm.required = !!password;
    confirm.setCustomValidity(password && confirm.value && password !== confirm.value ? "Konfirmasi kata sandi tidak sama." : "");
  }
  newPassword.addEventListener("input", updatePasswordStrength);
  confirm.addEventListener("input", updatePasswordStrength);
  updatePasswordStrength();
}
const dirtyHighlightForm = document.getElementById("highlight-form");
if (dirtyHighlightForm?.elements.namedItem("id")?.value) initDirtySave(dirtyHighlightForm);
document.querySelectorAll(".panel table").forEach(enhanceTable);
