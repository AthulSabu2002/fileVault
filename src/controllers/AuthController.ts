import { Request, Response, NextFunction } from 'express';
import supabase from '../utils/supabaseClient';

export default class AuthController {
    public createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required.' });
                return;
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                res.status(400).json({ error: signInError.message });
                return;
            }

            const jwt = signInData.session?.access_token;

            res.status(201).json({
                user: signInData.user,
                jwt,
            });
        } catch (err) {
            next(err);
        }
    }

    public signIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required.' });
                return;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const jwt = data.session?.access_token;

            res.status(200).json({
                user: data.user,
                jwt,
            });
        } catch (err) {
            next(err);
        }
    }
}