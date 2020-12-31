import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { DualConsumptionWithCosts } from "./poller";

export interface InfluxConfig {
    host: string;
    org: string;
    bucket: string;
    token: string;
}

export class InfluxAPI {
    private _client: InfluxDB;

    constructor(private _config: InfluxConfig) {
        this._client = new InfluxDB({
            url: _config.host,
            token: _config.token,
        });
    }

    async writeResults(results: DualConsumptionWithCosts[]): Promise<void> {
        const writeApi = this._client.getWriteApi(
            this._config.org,
            this._config.bucket
        );
        // first write pure usage
        const usagePoints: Point[] = results.map((v) => {
            const point = new Point("usage").timestamp(v.interval_start);
            v.gasConsumption !== undefined &&
                point.floatField("gas", v.gasConsumption);
            v.electricityConsumption !== undefined &&
                point.floatField("electricity", v.electricityConsumption);
            return point;
        });
        await writeApi.writePoints(usagePoints);

        // now write costs
        const costPoints: Point[] = [];
        results.forEach((v) => {
            //new Point('costs').timestamp(v.interval_end).floatField('gas', v.gasConsumption).floatField('electricity', v.electricityConsumption))
            v.costs.forEach((c) => {
                const point = new Point("costs")
                    .timestamp(v.interval_start)
                    .floatField("standingCharge", c.standingCharge.price)
                    .floatField("unitRate", c.unitRate.price)
                    .floatField("cost", c.cost);
                point.tag("type", c.tariff.type);
                point.tag("tariff", c.tariff.name);
                costPoints.push(point);
            });
        });
        await writeApi.writePoints(costPoints);
        return writeApi.close();
    }
}
