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
}