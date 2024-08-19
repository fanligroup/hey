import type { Request, Response } from 'express';

import prisma from '@hey/db/prisma/db/client';
import logger from '@hey/helpers/logger';
import parseJwt from '@hey/helpers/parseJwt';
import catchedError from 'src/helpers/catchedError';
import { rateLimiter } from 'src/helpers/middlewares/rateLimiter';
import validateLensAccount from 'src/helpers/middlewares/validateLensAccount';

// TODO: add tests
export const get = [
  rateLimiter({ requests: 100, within: 1 }),
  validateLensAccount,
  async (req: Request, res: Response) => {
    try {
      const identityToken = req.headers['x-identity-token'] as string;
      const payload = parseJwt(identityToken);

      const result = await prisma.draftPublication.findMany({
        orderBy: { updatedAt: 'desc' },
        where: { profileId: payload.id }
      });

      logger.info(`Drafts fetched for ${payload.id}`);

      return res.status(200).json({ result, success: true });
    } catch (error) {
      return catchedError(res, error);
    }
  }
];
