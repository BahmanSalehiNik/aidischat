export interface ImportedMedia {
  id: string;
  url: string;
  downloadUrl?: string;
  bucket?: string;
  key?: string;
  provider?: string;
  type?: string;
  size?: number;
}

function getConfig() {
  const baseUrl = process.env.MEDIA_SERVICE_URL || 'http://media-srv:3000';
  const token = process.env.MEDIA_INTERNAL_TOKEN;
  if (!token) {
    throw new Error('MEDIA_INTERNAL_TOKEN is not set');
  }
  return { baseUrl, token };
}

export async function importImageFromUrl(params: {
  userId: string;
  agentId?: string;
  sourceUrl: string;
  container?: string; // e.g. "posts"
  expiresSeconds?: number;
}): Promise<ImportedMedia> {
  const { baseUrl, token } = getConfig();

  const resp = await fetch(`${baseUrl}/api/media/internal/import`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': token,
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`media import failed: ${resp.status} ${text}`);
  }

  return (await resp.json()) as ImportedMedia;
}

export async function getInternalMedia(mediaId: string, expiresSeconds = 900): Promise<any> {
  const { baseUrl, token } = getConfig();

  const resp = await fetch(`${baseUrl}/api/media/internal/${mediaId}?expiresSeconds=${expiresSeconds}`, {
    headers: {
      'x-internal-token': token,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`media lookup failed: ${resp.status} ${text}`);
  }

  return await resp.json();
}


