import { backendUrl } from "@/lib/backend";

export interface ProjectResponse {
  content_checksum: string | null;
  content_size_bytes: number | null;
  content_updated_at: string | null;
  content_uri: string | null;
  created_at: string;
  description: string;
  id: string;
  metadata_json: Record<string, unknown>;
  title: string;
  updated_at: string;
  user_id: string;
}

export interface ProjectListResponse {
  projects: ProjectResponse[];
}

export interface SignedProjectUploadResponse {
  bucket_name: string;
  content_length: number;
  content_type: string;
  max_upload_size_bytes: number;
  method: string;
  object_name: string;
  signed_url_expiration_seconds: number;
  storage_uri: string;
  upload_url: string;
}

export interface SignedProjectDownloadResponse {
  bucket_name: string;
  download_url: string;
  method: string;
  object_name: string;
  signed_url_expiration_seconds: number;
  storage_uri: string;
}

export interface ProjectSaveToDrivePrepareRequest {
  content_checksum: string;
  content_length: number;
  content_type: string;
  description: string;
  metadata_json: Record<string, unknown>;
  project_id?: string;
  title: string;
}

export interface ProjectSaveToDrivePrepareResponse {
  needs_upload: boolean;
  project: ProjectResponse | null;
  project_id: string;
  upload: SignedProjectUploadResponse | null;
}

export interface ProjectSaveToDriveCompleteRequest {
  content_checksum: string;
  content_length: number;
  content_type: string;
  description: string;
  metadata_json: Record<string, unknown>;
  project_id: string;
  title: string;
}

export interface ProjectSyncResponse {
  download: SignedProjectDownloadResponse | null;
  needs_download: boolean;
  project: ProjectResponse;
}

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: JsonValue };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch (error) {
    // Ignore JSON parsing failure and fall through to status text.
  }

  return `${response.status} ${response.statusText}`.trim();
}

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(backendUrl(path), {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const message = await parseError(response);
    if (response.status === 429) {
      throw new RateLimitError(message);
    }
    if (response.status === 409) {
      throw new ProjectLimitError(message);
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function listProjects(): Promise<ProjectListResponse> {
  return requestJson<ProjectListResponse>("/api/projects/");
}

export async function prepareProjectSaveToDrive(
  payload: ProjectSaveToDrivePrepareRequest,
): Promise<ProjectSaveToDrivePrepareResponse> {
  return requestJson<ProjectSaveToDrivePrepareResponse>("/api/projects/save-to-drive/prepare", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function completeProjectSaveToDrive(
  payload: ProjectSaveToDriveCompleteRequest,
): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>("/api/projects/save-to-drive/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function syncProject(
  projectId: string,
  localChecksum: string | null,
): Promise<ProjectSyncResponse> {
  return requestJson<ProjectSyncResponse>(`/api/projects/${projectId}/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      local_checksum: localChecksum,
    }),
  });
}

export async function uploadProjectArchive(
  upload: SignedProjectUploadResponse,
  archiveBlob: Blob,
): Promise<void> {
  const response = await fetch(upload.upload_url, {
    method: upload.method,
    headers: {
      "Content-Type": upload.content_type,
    },
    body: archiveBlob,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status} ${response.statusText}`);
  }
}

export async function downloadProjectArchive(download: SignedProjectDownloadResponse): Promise<ArrayBuffer> {
  const response = await fetch(download.download_url, {
    method: download.method,
  });

  if (!response.ok) {
    throw new Error(`Download failed with ${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}
