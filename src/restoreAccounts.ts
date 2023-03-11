import * as SteamAccountModel from "./models/steamAccount.js";
import * as SteamAccountService from "./services/steamAccount.js";

export default async function restoreAccounts() {
  const accounts = await SteamAccountModel.getAll();
  const promises = [];

  for (const account of accounts) {
    if (
      account.state.status === "ingame" ||
      account.state.status === "online" ||
      account.state.status === "reconnecting"
    ) {
      promises.push(SteamAccountService.login(account.userId, { accountName: account.accountName }));
    }
  }

  return Promise.allSettled(promises);
}
