import "dotenv/config";
import assert from "assert";
import {
  decrypt,
  encrypt,
  isAuthError,
  isBadPassword,
  isBadSteamGuardCode,
  isSteamGuardError,
  mergeGamesArrays,
} from "../commons.js";
import { Game } from "@machiavelli/steam-client";

describe("common functions", () => {
  it("isSteamGuardError()", () => {
    assert.equal(isSteamGuardError("AccountLogonDenied"), true);
    assert.equal(isSteamGuardError("AccountLoginDeniedNeedTwoFactor"), true);
    assert.equal(isSteamGuardError("random"), false);
  });

  it("isBadSteamGuardCode()", () => {
    assert.equal(isBadSteamGuardCode("InvalidLoginAuthCode"), true);
    assert.equal(isBadSteamGuardCode("TwoFactorCodeMismatch"), true);
    assert.equal(isBadSteamGuardCode("random"), false);
  });

  it("isBadPassword()", () => {
    assert.equal(isBadPassword("InvalidPassword"), true);
    assert.equal(isBadPassword("random"), false);
  });

  it("isAuthError()", () => {
    assert.equal(isAuthError("AccountLogonDenied"), true);
    assert.equal(isAuthError("InvalidLoginAuthCode"), true);
    assert.equal(isAuthError("InvalidPassword"), true);
    assert.equal(isBadPassword("random"), false);
  });

  it("encrypt() and decrypt()", async () => {
    assert.equal(decrypt(encrypt("random")), "random");
    assert.equal(decrypt(encrypt("SD$R@#$SD")), "SD$R@#$SD");
    assert.throws(function () {
      assert.equal(decrypt(encrypt("random")), "random1");
    });

    const encrypted = encrypt("random");
    process.env.ENCRYPTION_KEY = "eYyCxb0PylB4wW1LkA9158a4BPLJNZCg";
    assert.throws(function () {
      assert.equal(decrypt(encrypted), "random");
    });
  });

  step("mergeGamesArrays()", () => {
    const game1 = [{ gameid: 1 }, { gameid: 2 }];
    const game2 = [{ gameid: 1 }, { gameid: 3 }];
    const { merge, difference } = mergeGamesArrays(game1 as Game[], game2 as Game[]);
    assert.equal(merge.length, 3);
    assert.equal(difference.length, 1);
    assert.equal(
      merge.some((game) => game.gameid === 3),
      true
    );
    assert.equal(
      difference.some((game) => game.gameid !== 1),
      true
    );
  });
});
