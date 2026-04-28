import { buildProjectArchive, parseProjectArchive } from "@/lib/outer-data/project-content";
import {
  BackendApiError,
  completeProjectSaveToCloud,
  deleteProject,
  downloadProjectArchive,
  listProjects,
  prepareProjectSaveToCloud,
  syncProject,
  uploadProjectArchive,
} from "@/lib/outer-data/backend-interface";

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class ProjectLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectLimitError";
  }
}

async function withErrorMapping<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof BackendApiError) {
      if (error.status === 429) {
        throw new RateLimitError(error.message);
      }
      if (error.status === 409) {
        throw new ProjectLimitError(error.message);
      }
    }
    throw error;
  }
}

// ── Input / Output types ────────────────────────────────────────────────────

export interface ProjectSaveInput {
  content: string;
  description: string;
  metadataJson?: Record<string, unknown>;
  projectId?: string;
  title: string;
}

export interface ProjectSaveResult {
  checksum: string;
  contentLength: number;
  projectId: string;
  title: string;
}

export interface ProjectLoadInput {
  projectId: string;
}

export interface ProjectLoadResult {
  checksum: string;
  content: string;
  contentLength: number;
  projectId: string;
  title: string;
}

export interface ProjectListItem {
  contentChecksum: string | null;
  contentUpdatedAt: string | null;
  createdAt: string;
  projectId: string;
  title: string;
  updatedAt: string;
}

export interface ProjectListResult {
  projects: ProjectListItem[];
}

export interface ProjectSyncInput {
  localChecksum: string | null;
  projectId: string;
}

export interface ProjectSyncResult {
  checksum: string | null;
  content: string | null;
  contentChecksum: string | null;
  needsSync: boolean;
  projectId: string;
  title: string;
}

// ── Strategy interface ──────────────────────────────────────────────────────

export interface ProjectStorage {
  readonly name: string;

  /** List all available projects. */
  list(): Promise<ProjectListResult>;

  /** Load / download a project by ID. */
  load(input: ProjectLoadInput): Promise<ProjectLoadResult>;

  /** Delete a project. */
  remove(projectId: string): Promise<void>;

  /** Create or update a project. */
  save(input: ProjectSaveInput): Promise<ProjectSaveResult>;

  /** Check remote state and reconcile. Returns new content when the remote is ahead. */
  sync(input: ProjectSyncInput): Promise<ProjectSyncResult>;
}

// ── Cloud implementation ────────────────────────────────────────────────────

class CloudProjectStorage implements ProjectStorage {
  readonly name = "Cloud";

  async save(input: ProjectSaveInput): Promise<ProjectSaveResult> {
    return withErrorMapping((async () => {
      const archive = await buildProjectArchive(input.content);

      const prepareResponse = await prepareProjectSaveToCloud({
        content_checksum: archive.checksum,
        content_length: archive.contentLength,
        content_type: archive.contentType,
        description: input.description,
        metadata_json: input.metadataJson ?? {},
        project_id: input.projectId,
        title: input.title,
      });

      if (prepareResponse.needs_upload) {
        if (!prepareResponse.upload) {
          throw new Error("The backend did not return a signed upload URL.");
        }
        await uploadProjectArchive(prepareResponse.upload, archive.archiveBlob);
      }

      const savedProject = prepareResponse.needs_upload
        ? await completeProjectSaveToCloud({
          content_checksum: archive.checksum,
          content_length: archive.contentLength,
          content_type: archive.contentType,
          description: input.description,
          metadata_json: input.metadataJson ?? {},
          project_id: prepareResponse.project_id,
          title: input.title,
        })
        : prepareResponse.project;

      if (!savedProject) {
        throw new Error("The backend did not return project metadata.");
      }

      return {
        checksum: archive.checksum,
        contentLength: archive.contentLength,
        projectId: savedProject.id,
        title: savedProject.title,
      };
    })());
  }

  async load(input: ProjectLoadInput): Promise<ProjectLoadResult> {
    return withErrorMapping((async () => {
      // Force a full download by syncing with a null checksum.
      const syncResponse = await syncProject(input.projectId, null);

      if (!syncResponse.download) {
        throw new Error("The backend did not provide a download URL.");
      }

      const archiveBuffer = await downloadProjectArchive(syncResponse.download);
      const parsed = await parseProjectArchive(archiveBuffer);

      return {
        checksum: syncResponse.project.content_checksum ?? parsed.checksum,
        content: parsed.content,
        contentLength: parsed.contentLength,
        projectId: syncResponse.project.id,
        title: syncResponse.project.title,
      };
    })());
  }

  async remove(projectId: string): Promise<void> {
    return withErrorMapping(deleteProject(projectId));
  }

  async list(): Promise<ProjectListResult> {
    return withErrorMapping((async () => {
      const response = await listProjects();

      return {
        projects: response.projects.map((project) => ({
          contentChecksum: project.content_checksum,
          contentUpdatedAt: project.content_updated_at,
          createdAt: project.created_at,
          projectId: project.id,
          title: project.title,
          updatedAt: project.updated_at,
        })),
      };
    })());
  }

  async sync(input: ProjectSyncInput): Promise<ProjectSyncResult> {
    return withErrorMapping((async () => {
      const syncResponse = await syncProject(input.projectId, input.localChecksum);

      if (syncResponse.needs_download && syncResponse.download) {
        const archiveBuffer = await downloadProjectArchive(syncResponse.download);
        const parsed = await parseProjectArchive(archiveBuffer);

        return {
          checksum: parsed.checksum,
          content: parsed.content,
          contentChecksum: syncResponse.project.content_checksum ?? parsed.checksum,
          needsSync: true,
          projectId: syncResponse.project.id,
          title: syncResponse.project.title,
        };
      }

      return {
        checksum: null,
        content: null,
        contentChecksum: syncResponse.project.content_checksum,
        needsSync: false,
        projectId: syncResponse.project.id,
        title: syncResponse.project.title,
      };
    })());
  }
}

// ── Local implementation ────────────────────────────────────────────────────

/**
 * Triggers a browser download for the given blob.
 */
function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();

  // Clean up after a short delay to ensure the download starts.
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Opens the browser file picker and returns the selected file's ArrayBuffer.
 */
function openFilePicker(accept: string): Promise<{ buffer: ArrayBuffer; name: string }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);

    let settled = false;

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      document.body.removeChild(input);

      if (!file) {
        settled = true;
        reject(new Error("No file was selected."));
        return;
      }

      settled = true;
      file
        .arrayBuffer()
        .then((buffer) => resolve({ buffer, name: file.name }))
        .catch(reject);
    });

    // Handle the case where the user cancels the file picker.
    input.addEventListener("cancel", () => {
      document.body.removeChild(input);
      if (!settled) {
        settled = true;
        reject(new Error("File selection was cancelled."));
      }
    });

    input.click();
  });
}

/**
 * Sanitizes a title string into a safe filename.
 */
function toFileName(title: string): string {
  const sanitized = title
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || "untitled";
}

class LocalProjectStorage implements ProjectStorage {
  readonly name = "Local";

  async save(input: ProjectSaveInput): Promise<ProjectSaveResult> {
    const archive = await buildProjectArchive(input.content);
    const fileName = `${toFileName(input.title)}.zip`;

    triggerBrowserDownload(archive.archiveBlob, fileName);

    // Generate a local-only ID so the caller can treat this like any other save.
    const localId = input.projectId ?? `local:${Date.now()}`;

    return {
      checksum: archive.checksum,
      contentLength: archive.contentLength,
      projectId: localId,
      title: input.title,
    };
  }

  async load(): Promise<ProjectLoadResult> {
    const { buffer, name } = await openFilePicker(".zip");
    const parsed = await parseProjectArchive(buffer);

    // Derive a title from the filename (strip the .zip extension).
    const title = name.replace(/\.zip$/i, "") || "Untitled";

    return {
      checksum: parsed.checksum,
      content: parsed.content,
      contentLength: parsed.contentLength,
      projectId: `local:${Date.now()}`,
      title,
    };
  }

  async remove(): Promise<void> {
    // No-op: the user manages local files themselves.
  }

  async list(): Promise<ProjectListResult> {
    // The browser cannot enumerate local files.
    return { projects: [] };
  }

  async sync(input: ProjectSyncInput): Promise<ProjectSyncResult> {
    // No remote state to reconcile with.
    return {
      checksum: null,
      content: null,
      contentChecksum: null,
      needsSync: false,
      projectId: input.projectId,
      title: "",
    };
  }
}

// ── Factory functions ───────────────────────────────────────────────────────

export function createCloudStorage(): ProjectStorage {
  return new CloudProjectStorage();
}

export function createLocalStorage(): ProjectStorage {
  return new LocalProjectStorage();
}
