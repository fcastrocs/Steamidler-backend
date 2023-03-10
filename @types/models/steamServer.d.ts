import { ObjectId } from "mongodb";

interface SteamCM {
  _id?: ObjectId;
  ip: string;
  port: number;
}
