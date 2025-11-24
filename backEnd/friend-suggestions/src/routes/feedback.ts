import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
  const { candidateId, action } = req.body as { candidateId: string; action: 'accept' | 'dismiss' };

  if (!candidateId || !action) {
    return res.status(400).send({ message: 'candidateId and action are required' });
  }

  // TODO: persist feedback for ranking experiments.
  console.log('Friend suggestion feedback', {
    userId: req.jwtPayload!.id,
    candidateId,
    action,
  });

  res.status(202).send({ received: true });
});

export { router as feedbackRouter };

