export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export type UploadResponse = {
  type: 'upload';
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  bytes: number;
  fileName?: string;
};

export type UploadedAsset = {
  mediaType: 'image' | 'gif' | 'video';
  mediaUrl: string;
  mediaId: string;
  date: string; // ISO timestamp
};

export type ListUploadsResponse = {
  type: 'listUploads';
  assets: UploadedAsset[];
};
