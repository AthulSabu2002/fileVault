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

  public createFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, parentFolderId } = req.body;
      const user = (req as any).user;
  
      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Folder name is required'
        });
        return;
      }
  
      const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      let folderPath = `${user.id}/${sanitizedName}`;
      let parentPath = user.id;
  
      if (parentFolderId) {
        const { data: parentFolder, error: parentError } = await supabase
          .from('folders')
          .select('path')
          .eq('id', parentFolderId)
          .eq('user_id', user.id)
          .single();
  
        if (parentError || !parentFolder) {
          res.status(404).json({
            success: false,
            message: 'Parent folder not found'
          });
          return;
        }
  
        folderPath = `${parentFolder.path}/${sanitizedName}`;
        parentPath = parentFolder.path;
      }
  
      // Get all folders at the same level
      const { data: existingFolders, error: checkError } = await supabase
        .from('folders')
        .select('name')
        .eq('user_id', user.id)
        .like('path', `${parentPath}/%`);
  
      if (existingFolders) {
        // Case insensitive check
        const folderExists = existingFolders.some(folder => 
          folder.name.toLowerCase() === sanitizedName.toLowerCase()
        );
  
        if (folderExists) {
          res.status(400).json({
            success: false,
            message: 'A folder with this name already exists (case insensitive)'
          });
          return;
        }
      }
  
      const { data: folderData, error: folderError } = await supabase
        .from('folders')
        .insert([
          {
            user_id: user.id,
            name: sanitizedName,
            path: folderPath
          }
        ])
        .select();
  
      if (folderError) {
        logError('Database error creating folder:', folderError);
        res.status(500).json({
          success: false,
          message: 'Failed to create folder'
        });
        return;
      }
  
      res.status(201).json({
        success: true,
        message: 'Folder created successfully',
        folder: folderData[0]
      });
  
    } catch (error) {
      logError('Unexpected error in createFolder:', error);
      next(error);
    }
  }
  
  /**
   * Lists all folders belonging to the authenticated user
   */
  public listFolders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
  
      const { data: folders, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
  
      if (error) {
        logError('Database error in listFolders:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch folders'
        });
        return;
      }
  
      res.status(200).json({
        success: true,
        folders
      });
    } catch (error) {
      logError('Unexpected error in listFolders:', error);
      next(error);
    }
  }
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
      const { folderId } = req.body;
      
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
      let filePath = `${user.id}/${uniqueFileName}`;
      
      // If folder is specified, update the file path
      if (folderId) {
        const { data: folderData, error: folderError } = await supabase
          .from('folders')
          .select('path')
          .eq('id', folderId)
          .eq('user_id', user.id)
          .single();
          
        if (folderError || !folderData) {
          res.status(404).json({
            success: false,
            message: 'Folder not found'
          });
          return;
        }
        
        // Use folder path instead of just user ID
        filePath = `${folderData.path}/${uniqueFileName}`;
      }
      
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
          is_encrypted: true,
          folder_id: folderId || null
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
   * Updates a folder name and maintains all file paths and nested folder paths
   */
  public updateFolderName = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { folderId, newName } = req.body;
      const user = (req as any).user;

      if (!folderId || !newName) {
        res.status(400).json({
          success: false,
          message: 'Folder ID and new name are required'
        });
        return;
      }

      const sanitizedName = newName.replace(/[^a-zA-Z0-9_-]/g, '_');

      const { data: folderData, error: folderError } = await supabase
        .from('folders')
        .select('*')
        .eq('id', folderId)
        .eq('user_id', user.id)
        .single();

      if (folderError || !folderData) {
        res.status(404).json({
          success: false,
          message: 'Folder not found'
        });
        return;
      }

      const oldPath = folderData.path;
      const pathParts = oldPath.split('/');
      
      const oldName = pathParts.pop();
      const parentPath = pathParts.join('/');
      
      const { data: existingFolders, error: checkError } = await supabase
        .from('folders')
        .select('name')
        .eq('user_id', user.id)
        .neq('id', folderId)
        .like('path', `${parentPath}/%`);
      
      if (existingFolders) {
        const folderExists = existingFolders.some(folder => 
          folder.name.toLowerCase() === sanitizedName.toLowerCase()
        );

        if (folderExists) {
          res.status(400).json({
            success: false,
            message: 'A folder with this name already exists (case insensitive)'
          });
          return;
        }
      }

      const newPath = `${parentPath}/${sanitizedName}`;
      
      const { data: filesInFolder, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('folder_id', folderId);
      
      if (filesError) {
        logError('Error finding files in folder:', filesError);
        res.status(500).json({
          success: false,
          message: 'Failed to find files in folder'
        });
        return;
      }
      
      const { data: nestedFolders, error: nestedFoldersError } = await supabase
        .from('folders')
        .select('*')
        .neq('id', folderId) 
        .ilike('path', `${oldPath}/%`);
      
      if (nestedFoldersError) {
        logError('Error finding nested folders:', nestedFoldersError);
        res.status(500).json({
          success: false,
          message: 'Failed to find nested folders'
        });
        return;
      }
      
      if (filesInFolder && filesInFolder.length > 0) {
        for (const file of filesInFolder) {
          const filePathParts = file.path.split('/');
          const filename = filePathParts.pop();
          const newFilePath = `${newPath}/${filename}`;
          
          const { error: moveError } = await supabase.storage
            .from('file-vault')
            .move(file.path, newFilePath);
          
          if (moveError) {
            logError(`Error moving file ${file.path}:`, moveError);
            res.status(500).json({
              success: false,
              message: `Failed to move file: ${file.originalname}`
            });
            return;
          }
          
          const { data: urlData } = supabase.storage
            .from('file-vault')
            .getPublicUrl(newFilePath);
            
          const publicUrl = urlData?.publicUrl || null;
          
          const { error: updateFileError } = await supabase
            .from('files')
            .update({
              path: newFilePath,
              url: publicUrl
            })
            .eq('id', file.id);
          
          if (updateFileError) {
            logError(`Error updating file record ${file.id}:`, updateFileError);
            res.status(500).json({
              success: false,
              message: `Failed to update file record: ${file.originalname}`
            });
            return;
          }
        }
      }
      
      if (nestedFolders && nestedFolders.length > 0) {
        for (const folder of nestedFolders) {
          const newNestedPath = folder.path.replace(oldPath, newPath);
          
          const { error: updateNestedError } = await supabase
            .from('folders')
            .update({ path: newNestedPath })
            .eq('id', folder.id);
          
          if (updateNestedError) {
            logError(`Error updating nested folder ${folder.id}:`, updateNestedError);
            res.status(500).json({
              success: false,
              message: `Failed to update nested folder: ${folder.name}`
            });
            return;
          }
          
          const { data: nestedFiles, error: nestedFilesError } = await supabase
            .from('files')
            .select('*')
            .eq('folder_id', folder.id);
          
          if (nestedFilesError) {
            logError(`Error finding files in nested folder ${folder.id}:`, nestedFilesError);
            continue;
          }
          
          if (nestedFiles && nestedFiles.length > 0) {
            for (const file of nestedFiles) {
              const newFilePath = file.path.replace(oldPath, newPath);
              
              const { error: moveError } = await supabase.storage
                .from('file-vault')
                .move(file.path, newFilePath);
              
              if (moveError) {
                logError(`Error moving nested file ${file.path}:`, moveError);
                continue;
              }
              
              const { data: urlData } = supabase.storage
                .from('file-vault')
                .getPublicUrl(newFilePath);
                
              const publicUrl = urlData?.publicUrl || null;
              
              await supabase
                .from('files')
                .update({
                  path: newFilePath,
                  url: publicUrl
                })
                .eq('id', file.id);
            }
          }
        }
      }
      
      const { error: updateError } = await supabase
        .from('folders')
        .update({
          name: sanitizedName,
          path: newPath
        })
        .eq('id', folderId);
      
      if (updateError) {
        logError('Error updating folder:', updateError);
        res.status(500).json({
          success: false,
          message: 'Failed to update folder'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Folder name updated successfully',
        folder: {
          id: folderId,
          name: sanitizedName,
          path: newPath
        }
      });
      
    } catch (error) {
      logError('Unexpected error in updateFolderName:', error);
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

  /**
   * Deletes a folder and all its contents (files and subfolders)
   */
  public deleteFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { folderId } = req.body;
      const user = (req as any).user;

      if (!folderId) {
        res.status(400).json({
          success: false,
          message: 'Folder ID is required'
        });
        return;
      }

      const { data: folderData, error: folderError } = await supabase
        .from('folders')
        .select('*')
        .eq('id', folderId)
        .eq('user_id', user.id)
        .single();

      if (folderError || !folderData) {
        res.status(404).json({
          success: false,
          message: 'Folder not found'
        });
        return;
      }

      const folderPath = folderData.path;

      const { data: nestedFolders, error: nestedFoldersError } = await supabase
        .from('folders')
        .select('id')
        .neq('id', folderId) 
        .ilike('path', `${folderPath}/%`); 

      if (nestedFoldersError) {
        logError('Error finding nested folders:', nestedFoldersError);
        res.status(500).json({
          success: false,
          message: 'Failed to find nested folders'
        });
        return;
      }
      
      const allFolderIds = [folderId];
      if (nestedFolders && nestedFolders.length > 0) {
        allFolderIds.push(...nestedFolders.map(folder => folder.id));
      }
      
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('*')
        .in('folder_id', allFolderIds);

      if (filesError) {
        logError('Error finding files in folders:', filesError);
        res.status(500).json({
          success: false,
          message: 'Failed to find files in folders'
        });
        return;
      }

      if (filesData && filesData.length > 0) {
        const filePaths = filesData.map(file => file.path);
        
        const { error: storageError } = await supabase.storage
          .from('file-vault')
          .remove(filePaths);

        if (storageError) {
          logError('Error deleting files from storage:', storageError);
          res.status(500).json({
            success: false,
            message: 'Failed to delete files from storage'
          });
          return;
        }

        const { error: deleteFilesError } = await supabase
          .from('files')
          .delete()
          .in('folder_id', allFolderIds);

        if (deleteFilesError) {
          logError('Error deleting file records:', deleteFilesError);
          res.status(500).json({
            success: false,
            message: 'Failed to delete file records'
          });
          return;
        }
      }
      
      if (nestedFolders && nestedFolders.length > 0) {
        const { error: deleteNestedFoldersError } = await supabase
          .from('folders')
          .delete()
          .in('id', nestedFolders.map(folder => folder.id));
        
        if (deleteNestedFoldersError) {
          logError('Error deleting nested folders:', deleteNestedFoldersError);
          res.status(500).json({
            success: false,
            message: 'Failed to delete nested folders'
          });
          return;
        }
      }

      const { error: deleteFolderError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (deleteFolderError) {
        logError('Error deleting main folder:', deleteFolderError);
        res.status(500).json({
          success: false,
          message: 'Failed to delete folder'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Folder and all contents deleted successfully'
      });

    } catch (error) {
      logError('Unexpected error in deleteFolder:', error);
      next(error);
    }
  }
}