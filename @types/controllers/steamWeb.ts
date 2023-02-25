import { ProfilePrivacy } from "@machiavelli/steam-web";

export interface ChangeAvatarBody {
  accountName: string;
  avatarDataURL: string;
}

export interface ClearAliasesBody {
  accountName: string;
}

export interface ChangePrivacyBody {
  accountName: string;
  privacy: ProfilePrivacy;
}
