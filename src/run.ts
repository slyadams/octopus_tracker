import moment from "moment";
import sleep from "sleep-promise";
import { InfluxAPI } from "./influx";
import { OctopusAPI, Tariff } from "./octopus";
import { Poller } from "./poller";

export async function run(
    influxApi: InfluxAPI,
    octopusApi: OctopusAPI,
    tariffs: Tariff[]
): Promise<void> {
    while (true) {
        console.log(`Poll started at ${new Date().toISOString()}`);
        const from: Date = moment().subtract(3, "month").toDate();
        await Poller.poll(from, tariffs, octopusApi, influxApi);
        console.log(`Poll finished at ${new Date().toISOString()}`);
        await sleep(30 * 60 * 1000);
    }
}
