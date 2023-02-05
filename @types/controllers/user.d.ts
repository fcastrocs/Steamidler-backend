import { ObjectId } from "mongodb";

export interface RegisterBody {
  username: string;
  email: string;
  password: string;
  inviteCode: string;
  ip: string;
  g_response: string;
}

export interface LoginBody {
  email: string;
  password: string;
  g_response: string;
}

export interface LogoutBody {
  userId: ObjectId;
}
