import { InfluxAPI } from "./influx";
import { Consumption, OctopusAPI, Rate, Tariff } from "./octopus";

interface TariffData {
    tariff: Tariff;
    standingCharges: Rate[];
    unitRates: Rate[];
}

interface DualConsumption {
    interval_start: Date;
    interval_end: Date;
    gasConsumption?: number;
    electricityConsumption?: number;
}

interface Cost {
    tariff: Tariff;
    standingCharge: Rate;
    unitRate: Rate;
    cost: number;
}

export interface DualConsumptionWithCosts extends DualConsumption {
    costs: Cost[];
}

export class Poller {
    static merge(
        tariffData: TariffData[],
        electricityConsumption: Consumption[],
        gasConsumption: Consumption[]
    ): DualConsumptionWithCosts[] {
        function findRate(rates: Rate[], time: Date): Rate | undefined {
            return rates.find(
                (rate) =>
                    rate.valid_from <= time &&
                    (!rate.valid_to || rate.valid_to >= time)
            );
        }

        // First merge the two sets of consumptions
        let mergedConsumptions: DualConsumption[] = gasConsumption.map((c) => ({
            interval_start: c.interval_start,
            interval_end: c.interval_end,
            gasConsumption: c.consumption,
        }));
        electricityConsumption.forEach((consumption) => {
            const existing = mergedConsumptions.find(
                (dc) =>
                    dc.interval_start.getTime() ===
                    consumption.interval_start.getTime()
            );
            if (existing) {
                existing.electricityConsumption = consumption.consumption;
            } else {
                mergedConsumptions.push({
                    interval_start: consumption.interval_start,
                    interval_end: consumption.interval_end,
                    electricityConsumption: consumption.consumption,
                });
            }
        });

        // Now apply all tariff prices
        const retVal: DualConsumptionWithCosts[] = mergedConsumptions.map(
            (mergedConsumption) => {
                return {
                    ...mergedConsumption,
                    costs: tariffData.map((tariff) => {
                        const standingCharge = findRate(
                            tariff.standingCharges,
                            mergedConsumption.interval_start
                        );
                        const unitRate = findRate(
                            tariff.unitRates,
                            mergedConsumption.interval_start
                        );

                        if (standingCharge && unitRate) {
                            if (tariff.tariff.type === "gas") {
                                return {
                                    tariff: tariff.tariff,
                                    cost:
                                        standingCharge.price / 48 +
                                        (mergedConsumption.gasConsumption ||
                                            0) *
                                            unitRate.price,
                                    standingCharge,
                                    unitRate,
                                };
                            } else {
                                return {
                                    tariff: tariff.tariff,
                                    cost:
                                        standingCharge.price / 48 +
                                        (mergedConsumption.electricityConsumption ||
                                            0) *
                                            unitRate.price,
                                    standingCharge,
                                    unitRate,
                                };
                            }
                        } else {
                            throw new Error(
                                `Unable to find ${
                                    !standingCharge
                                        ? "standing charge"
                                        : "unit rate"
                                } for tariff ${
                                    tariff.tariff.name
                                } at time ${mergedConsumption.interval_start.toISOString()}`
                            );
                        }
                    }),
                };
            }
        );
        return retVal;
    }

    static async poll(
        from: Date,
        tarrifs: Tariff[],
        octopusApi: OctopusAPI,
        influxApi: InfluxAPI
    ): Promise<void> {
        // get all rates
        const tariffData: TariffData[] = [];
        for (const tariff of tarrifs) {
            const rates = await Promise.all([
                octopusApi.getTarrifRates(from, tariff, "standing-charges"),
                octopusApi.getTarrifRates(from, tariff, "standard-unit-rates"),
            ]);
            tariffData.push({
                tariff,
                standingCharges: rates[0],
                unitRates: rates[1],
            });
        }

        // get consumption
        const [gasConsumption, electricityConsumption] = await Promise.all([
            octopusApi.getGasConsumption(from),
            octopusApi.getElectricityConsumption(from),
        ]);
        const results = Poller.merge(
            tariffData,
            electricityConsumption,
            gasConsumption
        );
        return influxApi.writeResults(results);
    }
}
