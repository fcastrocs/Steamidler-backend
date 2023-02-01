import { ProfilePrivacy } from "@machiavelli/steam-web";

interface ChangeAvatarBody {
  accountName: string;
  avatarDataURL: string;
}

interface ClearAliasesBody {
  accountName: string;
}

interface ChangePrivacyBody {
  accountName: string;
  privacy: ProfilePrivacy;
}
