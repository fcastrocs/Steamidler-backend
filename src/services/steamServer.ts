import fetch from "node-fetch";
import { SteamCM } from "../../@types/models/steamServer.js";
import * as SteamServerModel from "../models/steamServer.js";
import { SteamIdlerError } from "../commons.js";

const STEAMCMS_URL = "https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?format=json&cellid=0";
const CITY = "Ashburn";

const fetchCMs = async () => {
  const data = (await fetch(STEAMCMS_URL).then((res) => res.json())) as GetCMListResponse;

  // Fetch Steam CM servers
  const SteamCMList: SteamCM[] = data.response.serverlist.map((server) => {
    const split = server.split(":");
    return { ip: split[0], port: Number(split[1]) };
  });

  // Fetch CM location info and get only US/Ashburn servers
  const SteamCMInfo = await fetch("http://ip-api.com/batch", {
    method: "POST",
    body: JSON.stringify(
      SteamCMList.map((cm) => {
        return cm.ip;
      })
    ),
  }).then(async (res) => {
    const cmInfo = (await res.json()) as any[];
    return cmInfo.filter((cm) => {
      return cm.countryCode === "US" && cm.city === CITY;
    });
  });

  // Remap to ip and proxy
  const filteredSteamCMList = SteamCMList.filter((cm) => {
    return SteamCMInfo.filter((info) => info.query === cm.ip).length > 0;
  });

  if (!filteredSteamCMList.length) {
    throw new SteamIdlerError("Could not get US/Ashburn Steam CM servers.");
  }

  await SteamServerModel.add(filteredSteamCMList);
};

export { fetchCMs };
