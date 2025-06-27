import { Request, Response, NextFunction } from 'express';
import supabase from '../utils/supabaseClient';

export default class FileController {
  public uploadFile = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
      }

      const { originalname, filename, path, mimetype, size } = req.file;

      const { error } = await supabase.from('files').insert([
        {
          user_id: user.id,
          originalname,
          filename,
          path,
          mimetype,
          size
        }
      ]);
    

      res.status(200).json({
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path,
      });
    } catch (error) {
      next(error);
    }
  }

  public downloadFile = async (req: Request, res: Response) => {
    const { originalname } = req.body;
  
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('originalname', originalname)
      .single();
  
    if (error || !data) {
      res.status(404).json({ message: 'File not found' });
      return;
    }
  
    res.download(data.path, data.originalname);
  };

}
