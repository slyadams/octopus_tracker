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
    const hardFromDateString = process.env.HARD_FROM_DATE;
    const hardFromDateInit = hardFromDateString ? new Date(hardFromDateString) : null;
    const hardFromDate = hardFromDateInit && !isNaN(hardFromDateInit.getTime()) ? hardFromDateInit : null;

    while (true) {
        console.log(`Poll started at ${new Date().toISOString()}`);
        if (hardFromDate) {
            console.log(`With hard from date ${hardFromDate.toISOString()}`);
        }
        const fromInit: Date = moment().subtract(3, "month").toDate();
        let from = fromInit;
        if (hardFromDate && from < hardFromDate) {
            from = hardFromDate;
        }
        console.log(`Polling from ${from.toISOString()}`);

        await Poller.poll(from, tariffs, octopusApi, influxApi);
        console.log(`Poll finished at ${new Date().toISOString()}`);
        await sleep(30 * 60 * 1000);
    }
}
