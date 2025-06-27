import { Request, Response, NextFunction } from 'express';
import supabase from '../utils/supabaseClient';
import multer from 'multer';
import { FileUploadResponse, FileData } from '../types/file.types';

export const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const logError = (message: string, error: any) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(message, error);
  } else {
    console.error(message);
  }
};

export default class FileController {
  /**
   * Handles file upload to Supabase storage and records metadata in database
   */
  public uploadFile = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      const { originalname, mimetype, size } = req.file;
      const fileData = req.file.buffer;
      const bucketName = 'file-vault';

      const uniqueFileName = `${Date.now()}-${originalname}`;
      const filePath = `${user.id}/${uniqueFileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileData, {
          contentType: mimetype,
          upsert: false
        });

      if (uploadError) {
        logError('Upload error:', uploadError);
        
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to upload file to storage' 
        });
      }

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
        
      const publicUrl = urlData?.publicUrl || null;

      const { data: dbData, error: dbError } = await supabase.from('files').insert([
        {
          user_id: user.id,
          originalname,
          filename: uniqueFileName,
          path: filePath,
          mimetype,
          size,
          url: publicUrl
        }
      ]);

      if (dbError) {
        logError('Database error:', dbError);
        
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to save file metadata' 
        });
      }

      const response: FileUploadResponse = {
        filename: uniqueFileName,
        originalname,
        path: filePath,
        url: publicUrl
      };
      
      return res.status(200).json(response);
      
    } catch (error) {
      logError('Unexpected error in uploadFile:', error);
      
      return next(error);
    }
  }

  /**
   * Handles file download from Supabase storage
   */
  public downloadFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.body;
      const user = (req as any).user;
  
      if (!fileId) {
        return res.status(400).json({ 
          success: false, 
          message: 'File ID is required' 
        });
      }
      
      const { data: fileData, error: dbError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single();
  
      if (dbError || !fileData) {
        logError('Database query error or file not found:', dbError);
        
        return res.status(404).json({ 
          success: false, 
          message: 'File not found' 
        });
      }

      const typedFileData = fileData as unknown as FileData;
  
      const { data, error: downloadError } = await supabase.storage
        .from('file-vault')
        .download(typedFileData.path);
  
      if (downloadError || !data) {
        logError('Download error:', downloadError);
        
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to download file from storage' 
        });
      }
      
      res.setHeader('Content-Type', typedFileData.mimetype);
      res.setHeader('Content-Disposition', `attachment; filename="${typedFileData.originalname}"`);
      
      const buffer = await data.arrayBuffer();
      
      return res.send(Buffer.from(buffer));
      
    } catch (error) {
      logError('Unexpected error in downloadFile:', error);
      
      return next(error);
    }
  }
}