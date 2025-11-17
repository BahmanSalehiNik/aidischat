"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const routes_1 = require("./config/routes");
const requiredEnv = ['PORT', ...routes_1.requiredServiceEnvVars];
requiredEnv.forEach((key) => {
    if (!process.env[key]) {
        if (key === 'PORT') {
            process.env.PORT = '3000';
            return;
        }
        throw new Error(`Environment variable ${key} must be defined`);
    }
});
const port = parseInt(process.env.PORT, 10) || 3000;
app_1.app.listen(port, () => {
    console.log(`api-gateway listening on port ${port}`);
});
//# sourceMappingURL=index.js.map