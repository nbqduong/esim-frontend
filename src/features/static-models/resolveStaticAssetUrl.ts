export const resolveStaticAssetUrl = (url: string): string => {
  const baseUrl = import.meta.env.VITE_SYSTEM_STATIC_ASSETS_GCS_BUCKET_NAME;
  if (!baseUrl) {
    return url;
  }

  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }

  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanUrl = url.replace(/^\/+/, "");
  return `${cleanBase}/${cleanUrl}`;
};
