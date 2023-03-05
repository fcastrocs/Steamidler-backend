import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import fs from "fs";

class Mailer {
  private options: Mail.Options = {
    from: '"Steamidler.com" <noreply@steamidler.com>',
  };

  constructor() {}

  private connect() {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  public async sendInvite(to: string, invite: string) {
    const socket = this.connect();

    let html = await this.readFile("invite");
    html = html.replaceAll("{invite}", invite);

    await socket.sendMail({
      ...this.options,
      to,
      subject: "You've received an invite.",
      html,
    });

    socket.close();
  }

  public async sendPasswordReset(to: string, token: string) {
    const socket = this.connect();

    let html = await this.readFile("resetPassword");
    html = html.replaceAll("{token}", token);
    html = html.replaceAll("{email}", encodeURIComponent(to));

    await socket.sendMail({
      ...this.options,
      to,
      subject: "Password reset.",
      html,
    });

    socket.close();
  }

  private readFile(file: string): Promise<string> {
    return new Promise((resolve) => {
      fs.readFile(`./templates/${file}.html`, { encoding: "utf8" }, (err, data) => {
        if (err) throw err;
        resolve(data);
      });
    });
  }
}

export default Mailer;
