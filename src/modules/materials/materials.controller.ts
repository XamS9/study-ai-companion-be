import type { RequestHandler } from 'express';
import { createMaterialSchema, updateMaterialSchema } from './materials.schema.js';
import {
  createMaterial,
  deleteMaterial,
  getFlashcards,
  getMaterial,
  listMaterials,
  updateMaterial,
} from './materials.service.js';

export const list: RequestHandler = async (req, res) => {
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
  res.json(await listMaterials(req.db!, req.userId!, subjectId));
};

export const detail: RequestHandler<{ id: string }> = async (req, res) => {
  res.json(await getMaterial(req.db!, req.userId!, req.params.id));
};

export const flashcards: RequestHandler<{ id: string }> = async (req, res) => {
  res.json(await getFlashcards(req.db!, req.userId!, req.params.id));
};

export const create: RequestHandler = async (req, res) => {
  const input = createMaterialSchema.parse(req.body);
  res.status(201).json(await createMaterial(req.db!, req.userId!, input));
};

export const update: RequestHandler<{ id: string }> = async (req, res) => {
  const input = updateMaterialSchema.parse(req.body);
  res.json(await updateMaterial(req.db!, req.userId!, req.params.id, input));
};

export const remove: RequestHandler<{ id: string }> = async (req, res) => {
  await deleteMaterial(req.db!, req.userId!, req.params.id);
  res.status(204).end();
};
