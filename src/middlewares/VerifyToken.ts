import { Request, Response, NextFunction } from 'express';
import supabase from '../utils/supabaseClient';

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ message: 'Missing Authorization header' });
    return;
}

  const token = authHeader.split(' ')[1];

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return
}

  (req as any).user = data.user;
  next();
};