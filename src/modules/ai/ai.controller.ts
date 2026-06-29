import type { RequestHandler } from 'express';
import {
  generateFlashcardsSchema,
  generateQuestionsSchema,
  processMaterialSchema,
  summarizeSchema,
} from './ai.schema.js';
import { generateFlashcards, generateQuestions, processMaterial, summarize } from './ai.service.js';

export const questions: RequestHandler = async (req, res) => {
  const input = generateQuestionsSchema.parse(req.body);
  res.json({ questions: await generateQuestions(req.db!, req.userId!, input) });
};

export const summary: RequestHandler = async (req, res) => {
  const input = summarizeSchema.parse(req.body);
  res.json(await summarize(req.db!, req.userId!, input));
};

export const flashcards: RequestHandler = async (req, res) => {
  const input = generateFlashcardsSchema.parse(req.body);
  res.json({ flashcards: await generateFlashcards(req.db!, req.userId!, input) });
};

export const process: RequestHandler = async (req, res) => {
  const input = processMaterialSchema.parse(req.body);
  res.json(await processMaterial(req.db!, req.userId!, input));
};
