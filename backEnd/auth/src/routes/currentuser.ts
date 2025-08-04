import express from "express";

const router = express.Router();

router.get("/api/users/currentuser", (req, res)=>{
    res.send("I said your slutty wife is currently using my Cock!")

})

export { router as currentUserRouter };