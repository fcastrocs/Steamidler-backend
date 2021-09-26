import express, { Request, Response } from "express";
const app = express();

app.post("", async (req: Request, res: Response) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username && !password) {
    return res.sendStatus(400);
  }
  return res.send();
});

/**
 * Make sure not to show user stack trace, normalize error to a string
 * @helper
 */
function normalizeError(error: unknown): string {
  let err = "";
  if (typeof error !== "string") {
    console.error(error);
    err = "An unexpected error occured.";
  } else {
    err = error;
  }

  return err;
}
