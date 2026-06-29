import type { RequestHandler } from 'express';
import { regenerateQuestionsSchema } from '../ai/ai.schema.js';
import { regenerateSubjectQuestions } from '../ai/ai.service.js';
import { createSubjectSchema, updateSubjectSchema } from './subjects.schema.js';
import {
  createSubject,
  deleteSubject,
  getSubjectDetail,
  listQuestions,
  listSubjects,
  updateSubject,
} from './subjects.service.js';

export const list: RequestHandler = async (req, res) => {
  res.json(await listSubjects(req.db!, req.userId!));
};

export const detail: RequestHandler<{ id: string }> = async (req, res) => {
  res.json(await getSubjectDetail(req.db!, req.userId!, req.params.id));
};

export const create: RequestHandler = async (req, res) => {
  const input = createSubjectSchema.parse(req.body);
  res.status(201).json(await createSubject(req.db!, req.userId!, input));
};

export const update: RequestHandler<{ id: string }> = async (req, res) => {
  const input = updateSubjectSchema.parse(req.body);
  res.json(await updateSubject(req.db!, req.userId!, req.params.id, input));
};

export const remove: RequestHandler<{ id: string }> = async (req, res) => {
  await deleteSubject(req.db!, req.userId!, req.params.id);
  res.status(204).end();
};

export const questions: RequestHandler<{ id: string }> = async (req, res) => {
  res.json(await listQuestions(req.db!, req.userId!, req.params.id));
};

export const regenerateQuestions: RequestHandler<{ id: string }> = async (req, res) => {
  const { count } = regenerateQuestionsSchema.parse(req.body ?? {});
  const generated = await regenerateSubjectQuestions(req.db!, req.userId!, req.params.id, count);
  res.json({ questions: generated });
};
