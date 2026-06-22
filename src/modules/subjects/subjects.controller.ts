import type { RequestHandler } from 'express';
import { createSubjectSchema, updateSubjectSchema } from './subjects.schema.js';
import {
  createSubject,
  deleteSubject,
  getSubjectDetail,
  listSubjects,
  updateSubject,
} from './subjects.service.js';

export const list: RequestHandler = async (req, res) => {
  res.json(await listSubjects(req.userId!));
};

export const detail: RequestHandler<{ id: string }> = async (req, res) => {
  res.json(await getSubjectDetail(req.userId!, req.params.id));
};

export const create: RequestHandler = async (req, res) => {
  const input = createSubjectSchema.parse(req.body);
  res.status(201).json(await createSubject(req.userId!, input));
};

export const update: RequestHandler<{ id: string }> = async (req, res) => {
  const input = updateSubjectSchema.parse(req.body);
  res.json(await updateSubject(req.userId!, req.params.id, input));
};

export const remove: RequestHandler<{ id: string }> = async (req, res) => {
  await deleteSubject(req.userId!, req.params.id);
  res.status(204).end();
};
