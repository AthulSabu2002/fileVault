import { Request, Response, NextFunction } from 'express';
import supabase from '../utils/supabaseClient';
import multer from 'multer';
import { FileUploadResponse, FileData } from '../types/file.types';
import { encryptFile, decryptFile } from '../utils/encryptionUtils';

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
   * Lists all files belonging to the authenticated user
   */
  public listFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        logError('Database error in listFiles:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch files'
        });
        return;
      }

      res.status(200).json({
        success: true,
        files
      });
    } catch (error) {
      logError('Unexpected error in listFiles:', error);
      next(error);
    }
  }

  /**
   * Handles file upload to Supabase storage and records metadata in database
   * Files are encrypted before storage
   */
  public uploadFile = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!req.file) {
        res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
        return;
      }

      const { originalname, mimetype, size } = req.file;
      const fileData = req.file.buffer;
      const bucketName = 'file-vault';

      // Encrypt file data before upload
      const { encryptedData, iv, authTag } = encryptFile(fileData);

      const uniqueFileName = `${Date.now()}-${originalname}`;
      const filePath = `${user.id}/${uniqueFileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, encryptedData, {
          contentType: mimetype,
          upsert: false
        });

      if (uploadError) {
        logError('Upload error:', uploadError);
        
        res.status(500).json({ 
          success: false, 
          message: 'Failed to upload file to storage' 
        });
        return;
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
          url: publicUrl,
          iv,
          auth_tag: authTag,
          is_encrypted: true
        }
      ]);

      if (dbError) {
        logError('Database error:', dbError);
        
        res.status(500).json({ 
          success: false, 
          message: 'Failed to save file metadata' 
        });
        return;
      }

      const response: FileUploadResponse = {
        filename: uniqueFileName,
        originalname,
        path: filePath,
        url: publicUrl
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      logError('Unexpected error in uploadFile:', error);
      next(error);
    }
  }

  /**
   * Handles file download from Supabase storage
   * Decrypts files before sending to client
   */
  public downloadFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.body;
      const user = (req as any).user;
  
      if (!fileId) {
        res.status(400).json({ 
          success: false, 
          message: 'File ID is required' 
        });
        return;
      }
      
      const { data: fileData, error: dbError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single();
  
      if (dbError || !fileData) {
        logError('Database query error or file not found:', dbError);
        
        res.status(404).json({ 
          success: false, 
          message: 'File not found' 
        });
        return;
      }

      const typedFileData = fileData as unknown as FileData;
  
      const { data, error: downloadError } = await supabase.storage
        .from('file-vault')
        .download(typedFileData.path);
  
      if (downloadError || !data) {
        logError('Download error:', downloadError);
        
        res.status(500).json({ 
          success: false, 
          message: 'Failed to download file from storage' 
        });
        return;
      }
      
      let fileBuffer;
      
      // Check if the file is encrypted and needs decryption
      if (typedFileData.is_encrypted && typedFileData.iv && typedFileData.auth_tag) {
        const encryptedBuffer = await data.arrayBuffer();
        try {
          fileBuffer = decryptFile(
            Buffer.from(encryptedBuffer), 
            typedFileData.iv, 
            typedFileData.auth_tag
          );
        } catch (decryptionError) {
          logError('Decryption error:', decryptionError);
          res.status(500).json({ 
            success: false, 
            message: 'Failed to decrypt file' 
          });
          return;
        }
      } else {
        // Handle legacy files that were not encrypted
        const rawBuffer = await data.arrayBuffer();
        fileBuffer = Buffer.from(rawBuffer);
      }
      
      res.setHeader('Content-Type', typedFileData.mimetype);
      res.setHeader('Content-Disposition', `attachment; filename="${typedFileData.originalname}"`);
      
      res.send(fileBuffer);
      
    } catch (error) {
      logError('Unexpected error in downloadFile:', error);
      next(error);
    }
  }

  /**
 * Updates the file name in Supabase storage and database
 */
  public updateFileName = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId, newName } = req.body;
      const user = (req as any).user;

      if (!fileId || !newName) {
        res.status(400).json({
          success: false,
          message: 'File ID and new name are required'
        });
        return;
      }

      const { data: fileData, error: dbError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single();

      if (dbError || !fileData) {
        logError('Database query error or file not found:', dbError);
        res.status(404).json({
          success: false,
          message: 'File not found'
        });
        return;
      }

      const typedFileData = fileData as unknown as FileData;
      const oldPath = typedFileData.path;
      const fileExt = typedFileData.originalname.split('.').pop();
      const newFilename = `${newName}.${fileExt}`;
      const newPath = `${user.id}/${newFilename}`;

      const { error: moveError } = await supabase.storage
        .from('file-vault')
        .move(oldPath, newPath);

      if (moveError) {
        logError('Storage move error:', moveError);
        res.status(500).json({
          success: false,
          message: 'Failed to rename file in storage'
        });
        return;
      }

      const { data: urlData } = supabase.storage
        .from('file-vault')
        .getPublicUrl(newPath);
      const publicUrl = urlData?.publicUrl || null;

      const { error: updateDbError } = await supabase
        .from('files')
        .update({
          filename: newFilename,
          path: newPath,
          url: publicUrl
        })
        .eq('id', fileId)
        .eq('user_id', user.id);

      if (updateDbError) {
        logError('Database update error:', updateDbError);
        res.status(500).json({
          success: false,
          message: 'Failed to update file metadata'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'File name updated successfully',
        filename: newFilename,
        path: newPath,
        url: publicUrl
      });

    } catch (error) {
      logError('Unexpected error in updateFileName:', error);
      next(error);
    }
  }

  /**
   * Handles file delete from Supabase storage
   */
  public deleteFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.body;
      const user = (req as any).user;

      if (!fileId) {
        res.status(400).json({
          success: false,
          message: 'File ID is required'
        });
        return;
      }

      const { data: fileData, error: dbError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single();

      if (dbError || !fileData) {
        logError('Database query error or file not found:', dbError);
        res.status(404).json({
          success: false,
          message: 'File not found'
        });
        return;
      }

      const typedFileData = fileData as unknown as FileData;

      const { error: storageError } = await supabase.storage
        .from('file-vault')
        .remove([typedFileData.path]);

      if (storageError) {
        logError('Storage deletion error:', storageError);
        res.status(500).json({
          success: false,
          message: 'Failed to delete file from storage'
        });
        return;
      }

      const { error: deleteDbError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', user.id);

      if (deleteDbError) {
        logError('Database deletion error:', deleteDbError);
        res.status(500).json({
          success: false,
          message: 'Failed to delete file metadata'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      logError('Unexpected error in deleteFile:', error);
      next(error);
    }
  }
}