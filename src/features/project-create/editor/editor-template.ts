export function createEditorTemplate() {
  return `
    <div class="dom-editor">
      <div class="dom-editor__gutter" aria-hidden="true"></div>
      <div class="dom-editor__surface">
        <textarea
          class="dom-editor__textarea"
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          wrap="soft"
        ></textarea>
      </div>
    </div>
  `;
}
