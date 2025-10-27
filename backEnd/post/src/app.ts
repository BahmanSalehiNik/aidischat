import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";

import cookieSession from "cookie-session";


import { createPostRouter } from "./routes/post/createPost";
import { getPostRouter } from "./routes/post/getPost";
import { updatePostRouter } from "./routes/post/updatePost";

import { addCommentRouter } from "./routes/comment/addComment";
import { getCommentsRouter } from "./routes/comment/getComments";
import { getCommentByIdRouter } from "./routes/comment/getCommentById";
import { updateCommentRouter } from "./routes/comment/updateComment";
import { deleteCommentRouter } from "./routes/comment/deleteComment";


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

app.use(createPostRouter);
app.use(getPostRouter);
app.use(updatePostRouter);

app.use(addCommentRouter);
app.use(getCommentsRouter);
app.use(getCommentByIdRouter);
app.use(updateCommentRouter);
app.use(deleteCommentRouter);


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

