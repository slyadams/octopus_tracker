import axios, { AxiosBasicCredentials } from "axios";

export interface OctopusConfig {
    base: string;
    apiKey: string;
}

export interface ElectricMeter {
    mpan: string;
    serial: string;
}

export interface GasMeter {
    mpan: string;
    serial: string;
}

export interface Consumption {
    interval_start: Date;
    interval_end: Date;
    consumption: number;
}

export interface Rate {
    price: number;
    valid_from: Date;
    valid_to?: Date;
}

export interface ResponseProcessor<T> {
    (input: any): T;
}

export interface Tariff {
    type: "gas" | "electricity";
    name: string;
    productCode: string;
    tariffCode: string;
}

export class OctopusAPI {
    constructor(
        private _config: OctopusConfig,
        private _electricMeter: ElectricMeter,
        private _gasMeter: GasMeter
    ) {}

    private _makeConsumptionUrl(
        type: "gas" | "electricity",
        from: Date
    ): string {
        const meter = type === "gas" ? this._gasMeter : this._electricMeter;
        return `${this._config.base}/${type}-meter-points/${
            meter.mpan
        }/meters/${
            meter.serial
        }/consumption?period_from=${from.toISOString()}&page_size=25000`;
    }

    private _makeAuth(): AxiosBasicCredentials {
        return {
            username: this._config.apiKey,
            password: "",
        };
    }

    async getPagedData<T>(
        initUrl: string,
        processor: ResponseProcessor<T>
    ): Promise<T[]> {
        let data: T[] = [];
        let url = initUrl;
        while (url) {
            console.log(`Executing ${url}`);
            const response = await axios.get(url, { auth: this._makeAuth() });
            if (Array.isArray(response?.data?.results)) {
                data.push(
                    ...response.data.results.map((result: any) =>
                        processor(result)
                    )
                );
            } else {
                throw new Error(`Badly formed paged result`);
            }
            url = response?.data?.next;
        }
        return data;
    }

    async getConsumption(
        type: "gas" | "electricity",
        from: Date
    ): Promise<Consumption[]> {
        const url = this._makeConsumptionUrl(type, from);
        const processor: ResponseProcessor<Consumption> = (result: any) => ({
            ...result,
            interval_start: new Date(result.interval_start),
            interval_end: new Date(result.interval_end),
        });
        return this.getPagedData<Consumption>(url, processor);
    }

    async getGasConsumption(from: Date): Promise<Consumption[]> {
        return this.getConsumption("gas", from);
    }

    async getElectricityConsumption(from: Date): Promise<Consumption[]> {
        return this.getConsumption("electricity", from);
    }

    async getTarrifRates(
        from: Date,
        tariff: Tariff,
        type: "standard-unit-rates" | "standing-charges"
    ): Promise<Rate[]> {
        const url = `${this._config.base}/products/${tariff.productCode}/${
            tariff.type
        }-tariffs/${
            tariff.tariffCode
        }/${type}?period_from=${from.toISOString()}&page_size=10000`;
        const processor: ResponseProcessor<Rate> = (result: any) => ({
            price: result.value_inc_vat / 100,
            valid_from: new Date(result.valid_from),
            valid_to: result.valid_to ? new Date(result.valid_to) : undefined,
        });
        return this.getPagedData<Rate>(url, processor);
    }
}
