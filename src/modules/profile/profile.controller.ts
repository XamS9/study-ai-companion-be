import type { RequestHandler } from 'express';
import { updateProfileSchema } from './profile.schema.js';
import { getProfile, updateProfile } from './profile.service.js';

export const get: RequestHandler = async (req, res) => {
  res.json(await getProfile(req.userId!));
};

export const update: RequestHandler = async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  res.json(await updateProfile(req.userId!, input));
};
