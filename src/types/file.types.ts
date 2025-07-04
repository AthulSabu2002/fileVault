export interface FileUploadResponse {
  filename: string;
  originalname: string;
  path: string;
  url: string | null;
}

export interface FileData {
  id: string;
  user_id: string;
  originalname: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
  url: string | null;
  created_at: string;
  iv?: string;
  auth_tag?: string;
  is_encrypted: boolean;
}

export interface FolderData {
  id: string;
  user_id: string;
  name: string;
  path: string;
  created_at: string;
}