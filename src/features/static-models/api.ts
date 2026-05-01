import { requestJson } from "@/lib/outer-data/backend-interface";

export interface StaticAsset {
  id: string;
  title: string;
  permission: "Public" | "Private";
  url: string;
}

export async function fetchPublicStaticAssets(): Promise<StaticAsset[]> {
  return requestJson<StaticAsset[]>("/api/static-assets");
}
