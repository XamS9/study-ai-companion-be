import type { RequestHandler } from 'express';
import { createExamSchema, submitExamSchema } from './exams.schema.js';
import {
  createExam,
  deleteExam,
  getExamDetail,
  listExams,
  submitExam,
} from './exams.service.js';

export const list: RequestHandler = async (req, res) => {
  res.json(await listExams(req.db!, req.userId!));
};

export const detail: RequestHandler<{ id: string }> = async (req, res) => {
  res.json(await getExamDetail(req.db!, req.userId!, req.params.id));
};

export const create: RequestHandler = async (req, res) => {
  const input = createExamSchema.parse(req.body);
  res.status(201).json(await createExam(req.db!, req.userId!, input));
};

export const submit: RequestHandler<{ id: string }> = async (req, res) => {
  const input = submitExamSchema.parse(req.body);
  res.json(await submitExam(req.db!, req.userId!, req.params.id, input));
};

export const remove: RequestHandler<{ id: string }> = async (req, res) => {
  await deleteExam(req.db!, req.userId!, req.params.id);
  res.status(204).end();
};
