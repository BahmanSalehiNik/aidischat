import { app } from './app';
import { requiredServiceEnvVars } from './config/routes';

const requiredEnv = ['PORT', ...requiredServiceEnvVars];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    if (key === 'PORT') {
      process.env.PORT = '3000';
      return;
    }
    throw new Error(`Environment variable ${key} must be defined`);
  }
});

const port = parseInt(process.env.PORT!, 10) || 3000;

app.listen(port, () => {
  console.log(`api-gateway listening on port ${port}`);
});

