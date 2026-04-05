import "./editor.css";

import { createEditorTemplate } from "./editor-template";

export interface EditorSnapshot {
  charCount: number;
  content: string;
  currentColumn: number;
  currentLine: number;
  lineCount: number;
}

export interface EditorMountOptions {
  initialContent?: string;
  onChange?: (snapshot: EditorSnapshot) => void;
  placeholder?: string;
}

export interface EditorHandle {
  destroy: () => void;
  focus: () => void;
  getContent: () => string;
  getSnapshot: () => EditorSnapshot;
  insertText: (text: string) => void;
  setContent: (content: string) => void;
}

function getSnapshot(textarea: HTMLTextAreaElement): EditorSnapshot {
  const content = textarea.value;
  const selectionStart = textarea.selectionStart ?? content.length;
  const lines = content.split("\n");
  const activeLines = content.slice(0, selectionStart).split("\n");
  const currentLine = activeLines.length;
  const currentColumn = activeLines[activeLines.length - 1]?.length ?? 0;

  return {
    charCount: content.length,
    content,
    currentColumn: currentColumn + 1,
    currentLine,
    lineCount: Math.max(lines.length, 1),
  };
}

function renderGutter(gutter: HTMLDivElement, snapshot: EditorSnapshot) {
  gutter.replaceChildren();

  for (let index = 0; index < snapshot.lineCount; index += 1) {
    const line = document.createElement("div");
    line.className = "dom-editor__line";
    if (index + 1 === snapshot.currentLine) {
      line.classList.add("dom-editor__line--active");
    }
    line.textContent = String(index + 1);
    gutter.append(line);
  }
}

export function mountEditor(
  mountElement: HTMLElement,
  options: EditorMountOptions = {},
): EditorHandle {
  mountElement.innerHTML = createEditorTemplate();

  const gutter = mountElement.querySelector(".dom-editor__gutter");
  const textarea = mountElement.querySelector(".dom-editor__textarea");

  if (!(gutter instanceof HTMLDivElement) || !(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("Failed to mount editor host");
  }

  let snapshot = getSnapshot(textarea);

  textarea.value = options.initialContent ?? "";
  textarea.placeholder = options.placeholder ?? "";
  snapshot = getSnapshot(textarea);
  renderGutter(gutter, snapshot);
  options.onChange?.(snapshot);

  const syncSnapshot = () => {
    snapshot = getSnapshot(textarea);
    renderGutter(gutter, snapshot);
    options.onChange?.(snapshot);
  };

  const syncScroll = () => {
    gutter.scrollTop = textarea.scrollTop;
  };

  const handleInput = () => {
    syncSnapshot();
    syncScroll();
  };

  const handleSelectionChange = () => {
    syncSnapshot();
  };

  textarea.addEventListener("input", handleInput);
  textarea.addEventListener("click", handleSelectionChange);
  textarea.addEventListener("keyup", handleSelectionChange);
  textarea.addEventListener("scroll", syncScroll);
  textarea.addEventListener("select", handleSelectionChange);

  return {
    destroy() {
      textarea.removeEventListener("input", handleInput);
      textarea.removeEventListener("click", handleSelectionChange);
      textarea.removeEventListener("keyup", handleSelectionChange);
      textarea.removeEventListener("scroll", syncScroll);
      textarea.removeEventListener("select", handleSelectionChange);
      mountElement.replaceChildren();
    },
    focus() {
      textarea.focus();
    },
    getContent() {
      return textarea.value;
    },
    getSnapshot() {
      return snapshot;
    },
    insertText(text: string) {
      const selectionStart = textarea.selectionStart ?? textarea.value.length;
      const selectionEnd = textarea.selectionEnd ?? textarea.value.length;

      textarea.setRangeText(text, selectionStart, selectionEnd, "end");
      syncSnapshot();
      syncScroll();
    },
    setContent(content: string) {
      textarea.value = content;
      syncSnapshot();
      syncScroll();
    },
  };
}
