import { InfluxAPI } from "./influx";
import { OctopusAPI, Tariff } from "./octopus";
import { program } from "commander";
import { run } from "./run";
import * as path from "path";
require("dotenv").config();

program.option("-t, --tariffFile <tariffFile>", "JSON Tariff File", "./tariffs.json").parse(process.argv);

const tariffs: Tariff[] = require(path.resolve(program.tariffFile));

console.log("Found tariffs: ", tariffs.map((t) => t.name).join(", "));

const token = process.env.INFLUX_TOKEN || "energy_token";
const org = process.env.INFLUX_ORG || "root";
const bucket = process.env.INFLUX_BUCKET || "energy";
const influxHost = process.env.INFLUX_HOST || "http://influxdb";
const influxPort = process.env.INFLUX_PORT || "8086";
const octopusApiKey = process.env.OCTOPUS_APIKEY || "";
const octopusHost = process.env.OCTOPUS_HOST || "https://api.octopus.energy";
const electricityMpan = process.env.ELECTRICITY_MPAN || "";
const electricitySerial = process.env.ELECTRICITY_SERIAL || "";
const gasMpan = process.env.GAS_MPAN || "";
const gasSerial = process.env.GAS_SERIAL || "";

const influxApi = new InfluxAPI({
    host: `${influxHost}:${influxPort}`,
    org,
    bucket,
    token,
});
const octopusApi = new OctopusAPI(
    { apiKey: octopusApiKey, base: `${octopusHost}/v1` },
    { mpan: electricityMpan, serial: electricitySerial },
    { mpan: gasMpan, serial: gasSerial }
);

run(influxApi, octopusApi, tariffs)
    .then(() => {
        console.log("Done");
    })
    .catch((error) => {
        console.error(error);
    });
