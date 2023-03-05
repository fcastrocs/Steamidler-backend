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

export interface ResetPasswordBody {
  email: string;
  g_response: string;
}

export interface UpdatePasswordBody {
  email: string;
  token: string;
  g_response: string;
  password: string;
}

export interface VerifyAuthBody {
  accessToken: string;
  refreshToken: string;
}
