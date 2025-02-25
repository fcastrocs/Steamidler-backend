import { ProfilePrivacy } from "@fcastrocs/steamclient";

interface Base {
  accountName?: string;
}

export interface ChangeAvatarBody extends Base {
  avatarDataURL: string;
}

export interface ClearAliasesBody extends Base {}

export interface ChangePrivacyBody extends Base {
  privacy: ProfilePrivacy;
}

export interface GetFarmableGamesBody extends Base {}

export interface GetAvatarFrameBody extends Base {}