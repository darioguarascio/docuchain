import { body } from 'express-validator';

export const createDocumentValidator = [
  body('template')
    .notEmpty()
    .withMessage('Template is required')
    .isString()
    .withMessage('Template must be a string'),
  body('placeholders')
    .optional()
    .isObject()
    .withMessage('Placeholders must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  body('async')
    .optional()
    .isBoolean()
    .withMessage('async must be a boolean'),
];

export const previewDocumentValidator = [
  body('template')
    .notEmpty()
    .withMessage('Template is required')
    .isString()
    .withMessage('Template must be a string'),
  body('placeholders')
    .optional()
    .isObject()
    .withMessage('Placeholders must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

