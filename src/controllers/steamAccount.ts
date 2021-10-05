import Steam, { LoginOptions } from "ts-steam";
import SteamCommunity from "steamcommunity";
import { SocksClientOptions } from "socks";
import * as SteamAccountModel from "../models/steamAccount";
import * as ProxyModel from "../models/proxy";
import * as SteamcmModel from "../models/steamcm";
import * as SteamVerifyModel from "../models/steamVerify";
import * as AutoLogin from "../models/autoLogin";
import SteamStore from "./SteamStore";
// import types
import { AddOptions, LoginRes, SteamAccount, SteamCM, ExtendedAccountAuth, ExtendedAccountData, Proxy } from "@types";

const PersonaState = {
  Offline: 0,
  Online: 1,
  Busy: 2,
  Away: 3,
  Snooze: 4,
};

/**
 * Add new account
 * @controller
 */
export async function add(options: AddOptions): Promise<void> {
  const userId = options.userId;
  const username = options.username;
  const password = options.password;

  if (SteamStore.has(userId, username)) {
    throw "This Steam account is already online.";
  }

  if (await SteamAccountModel.exists(userId, username)) {
    throw "This Steam account already exists.";
  }

  // set login options
  const loginOptions: LoginOptions = {
    accountName: username,
    password: password,
  };

  // check if account is waiting for steam guard code
  const steamVerify = await SteamVerifyModel.get(userId, username);
  if (steamVerify) {
    // steam guard code was not provided
    if (!options.code) {
      throw "Steam guard code is needed.";
    }

    // set code to loginOptions
    if (steamVerify.authType === "email") {
      loginOptions.authCode = options.code;
    } else {
      loginOptions.twoFactorCode = options.code;
    }
  }

  const proxy = steamVerify ? steamVerify.proxy : await ProxyModel.getOne();

  // attempt CM login
  const loginRes = await fullyLogin(userId, loginOptions, proxy);
  // add to store
  SteamStore.add(userId, username, loginRes.steam);
  // add autologin
  await AutoLogin.add(userId, username);

  // Create account model
  const steamAccount: SteamAccount = {
    userId,
    username,
    password,
    auth: loginRes.accountAuth,
    data: loginRes.accountData,
    state: {
      status: "online",
      personaState: PersonaState.Online,
      isFarming: false,
      gamesIdling: [],
      gamesFarming: [],
      proxy: proxy,
    },
  };

  // save to db
  await SteamAccountModel.add(steamAccount);

  // listen to disconnects
  disconnectListener(steamAccount, loginRes.steam);
}

/**
 * logs in a steam account
 * @controller
 */
export async function login(userId: string, username: string): Promise<void> {
  if (SteamStore.has(userId, username)) {
    throw "This steam account is already online.";
  }

  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw "This Steam account does not exist.";
  }

  // set login options
  const loginOptions: LoginOptions = {
    accountName: username,
    password: <string>steamAccount.password,
    machineName: steamAccount.auth.machineName,
    loginKey: steamAccount.auth.loginKey,
    shaSentryfile: steamAccount.auth.sentry ? Buffer.from(steamAccount.auth.sentry.buffer) : undefined,
  };

  // re-obtain sentry and loginKey after a verification or InvalidPassword error
  if (
    steamAccount.state.error &&
    (isVerificationError(steamAccount.state.error) || steamAccount.state.error === "InvalidPassword")
  ) {
    delete loginOptions.loginKey;
    delete loginOptions.shaSentryfile;
  }

  const proxy = await ProxyModel.getOne();

  // attempt CM login
  let loginRes: LoginRes;
  try {
    loginRes = await fullyLogin(userId, loginOptions, proxy);
  } catch (error) {
    // got verification or InvalidPassword error
    if (isVerificationError(error) || error === "InvalidPassword") {
      steamAccount.state.error = error;
      await SteamAccountModel.update(steamAccount);
    }
    throw error;
  }

  // save to store
  SteamStore.add(userId, username, loginRes.steam);
  // Save autologin
  await AutoLogin.add(userId, username);

  // update steam account
  steamAccount.auth = loginRes.accountAuth;
  steamAccount.data = loginRes.accountData;
  steamAccount.state.status = "online";
  steamAccount.state.proxy = proxy;
  delete steamAccount.state.error;
  await SteamAccountModel.update(steamAccount);

  // listen to disconnects
  disconnectListener(steamAccount, loginRes.steam);

  // restore personastate
  // retore farming...
  // restore idling games if any
}

/**
 * Logs out a steam account
 * @controller
 */
export async function logout(userId: string, username: string): Promise<void> {
  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw "This Steam account doesn't exists.";
  }

  const steam = SteamStore.get(userId, username);
  if (steam) {
    steam.destroyConnection(true);
    SteamStore.remove(userId, username);
  }

  await AutoLogin.remove(userId, username);

  //change necessary steamaccount states
  steamAccount.state.status = "offline";
  await SteamAccountModel.update(steamAccount);

  //stop farming
}

export async function remove(userId: string, username: string): Promise<void> {
  if (!(await SteamAccountModel.remove(userId, username))) {
    throw "This Steam account does not exits.";
  }

  const steam = SteamStore.remove(userId, username);
  if (steam) {
    steam.destroyConnection(true);
    // stop farming
    // todo
  }

  await AutoLogin.remove(userId, username);
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId: string, username: string, nick: string): Promise<void> {
  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw "This Steam account does not exist.";
  }

  const steam = SteamStore.get(userId, username);
  if (!steam) {
    throw "This Steam account is not online";
  }

  steam.clientChangeStatus({ playerName: nick });

  // update db
  steamAccount.data.nickname = nick;
  await SteamAccountModel.update(steamAccount);
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId: string, username: string, avatar: Express.Multer.File): Promise<void> {
  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw "This Steam account does not exist.";
  }

  const steam = SteamStore.get(userId, username);
  if (!steam) {
    throw "This Steam account is not online";
  }

  const steamcommunity = new SteamCommunity(steamAccount.data.steamId, steamAccount.state.proxy, 10000);
  steamcommunity.cookie = steamAccount.auth.cookie;

  const avatarUrl = await steamcommunity.changeAvatar({ buffer: avatar.buffer, type: avatar.mimetype });

  // update db
  steamAccount.data.avatar = avatarUrl;
  await SteamAccountModel.update(steamAccount);
}

/**
 * Fully logs in a steam account
 * Logs in to steamcm, steamcommunity, then gets inventory and farmData
 * Creates a SteamVerify if Steam asks for a code
 */
async function fullyLogin(userId: string, loginOptions: LoginOptions, proxy: Proxy): Promise<LoginRes> {
  const steamcm = await SteamcmModel.getOne();
  // attempt CM login
  let loginRes: LoginRes;
  try {
    // login
    loginRes = await steamcmLogin(loginOptions, proxy, steamcm);
    console.log("steamcm logged in");
  } catch (error) {
    // Steam is asking for guard code
    if (isVerificationError(error)) {
      // save this config to reuse when user enters the code
      SteamVerifyModel.add({
        userId,
        username: loginOptions.accountName,
        proxy,
        authType: error === "AccountLogonDenied" || error === "AccountLoginDeniedNeedTwoFactor" ? "email" : "mobile",
      });
      throw "GuardCodeNeeded";
    }
    throw error;
  }

  // attempt steamcommunity login
  const webNonce = loginRes.accountAuth.webNonce;
  const steamId = loginRes.accountData.steamId;

  const steamcommunity = new SteamCommunity(steamId, proxy, 10000, webNonce);
  loginRes.accountAuth.cookie = await steamcommunity.login();
  console.log("steamcommunity logged in");

  // get inventory and farm data
  loginRes.accountData.items = await steamcommunity.getCardsInventory();
  loginRes.accountData.farmData = await steamcommunity.getFarmingData();

  return loginRes;
}

/**
 * Logins to steam via cm
 * @helper
 */
async function steamcmLogin(loginOptions: LoginOptions, proxy: Proxy, steamcm: SteamCM): Promise<LoginRes> {
  // setup socks options
  const socksOptions: SocksClientOptions = {
    proxy: {
      host: proxy.ip,
      port: proxy.port,
      type: 5,
    },
    destination: {
      host: steamcm.ip,
      port: steamcm.port,
    },
    command: "connect",
  };

  // connect to steam
  const steam = new Steam();
  // connect can throw 'dead proxy or steamcm' or 'encryption failed'
  await steam.connect(socksOptions, 10000);

  // listen and handle steam events
  // listenToSteamEvents(userId, loginOptions.accountName, steam);

  // attempt cm login
  const res = await steam.login(loginOptions);

  return {
    accountAuth: <ExtendedAccountAuth>res.auth,
    accountData: <ExtendedAccountData>res.data,
    steam,
  };
}

/**
 * @listener
 */
function disconnectListener(steamAccount: SteamAccount, steam: Steam) {
  steam.on("disconnected", async () => {
    console.log(`STEAM ACCOUNT DISCONNECTED: ${steamAccount.username}`);

    // stop farming interval if exists
    //stopFarmingInterval(userId, accountName);

    // remove from online accounts
    // SteamMap.remove(userId, accountName);

    // attempt reconnect
    // await attempReconnect(userId, accountName);
  });
}

/**
 * @helper
 */
function isVerificationError(error: string): boolean {
  if (
    error === "AccountLogonDenied" || // need email code
    error === "TwoFactorCodeMismatch" || // invalid mobile code ?
    error === "AccountLoginDeniedNeedTwoFactor" || // need mobile code
    error === "InvalidLoginAuthCode" // invalid email code
  ) {
    return true;
  }
  return false;
}
