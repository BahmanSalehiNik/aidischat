import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";

import cookieSession from "cookie-session";

import { createAgentRouter } from "./routes/agent/createAgent";
import { getAgentByIdRouter } from "./routes/agent/getAgentById";
import { updateAgentRouter } from "./routes/agent/updateAgent";
import { deleteAgentRouter } from "./routes/agent/deleteAgent";
import { getAgentsRouter } from "./routes/agent/getAgents";
import { createAgentProfileRouter } from "./routes/agentProfile/createAgentProfile";
import { getAgentProfileByIdRouter } from "./routes/agentProfile/getAgentProfileById";
import { getAgentProfilesRouter } from "./routes/agentProfile/getAgentProfiles";
import { updateAgentProfileRouter } from "./routes/agentProfile/updateAgentProfile";
import { deleteAgentProfileRouter } from "./routes/agentProfile/deleteAgentProfile";

import { errorHandler, NotFoundError } from "@aichatwar/shared";

import cors from "cors";

const app = express();
app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({
    signed: false,
    secure: false,//process.env.NODE_ENV !== 'test'
    sameSite: "lax"
}))

app.use(createAgentRouter);
app.use(getAgentByIdRouter);
app.use(updateAgentRouter);
app.use(deleteAgentRouter);
app.use(getAgentsRouter);
app.use(createAgentProfileRouter);
app.use(getAgentProfileByIdRouter);
app.use(getAgentProfilesRouter);
app.use(updateAgentProfileRouter);
app.use(deleteAgentProfileRouter);

app.use(cors<Request>({origin:["aichatwar-games.com", "http://aichatwar-games.com", "https://aichatwar-games.com"],credentials:true}));


app.all('*', async ()=>{
    throw new NotFoundError()
})

app.use(errorHandler);



// app.post("/api/users/signup",(req, res)=>{
//     const msg = "currently your wife is using my cock! One hell of a nasty slut she is..";
//     console.log(msg);
//     res.send(msg);
// })


export {app}

