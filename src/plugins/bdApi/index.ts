/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FilterFn } from "@webpack";
import { Logger } from "@utils/Logger";
import path from "./path-browserify";
import { localStorage } from "@utils/localStorage";


interface GetModuleOptions {
    first?: boolean,
    defaultExport?: boolean,
    searchExports?: boolean;
}
const BdWebpack = {
    logger: new Logger("BdApi Webpack", "#2f5b9d"),
    getModule(filter: FilterFn, options: GetModuleOptions | undefined) {
        options = {
            first: options?.first ? options.first : true,
            defaultExport: options?.defaultExport ? options.defaultExport : true,
            searchExports: options?.searchExports ? options.searchExports : false,
        };

        const results: Array<any> = [];
        // FIXME: use c-style for loop because it's faster
        Object.values(Vencord.Webpack.cache).forEach(mod => {
            if (filter(mod)) {
                results.push(mod);
            }

            if (options?.searchExports) {

            }
        });
    }
};

class BdStorage {
    static saveData(pluginName: string, key: string, data: any) {
        localStorage.setItem(`${pluginName}_${key}`, JSON.stringify(data));
    }
    static loadData(pluginName: string, key: string, data: any) {
        JSON.parse(localStorage.getItem(`${pluginName}_${key}`) as string);
    }
    getData = BdStorage.loadData;
}

export default definePlugin({
    name: "BdApi",
    description: "Provides an implementation of BetterDiscord's BdApi.",
    authors: [Devs.DustyAngel47],
    patches: [],
    start() {
        const bdStorage = new BdStorage();

        globalThis.BdApi = {
            Webpack: BdWebpack,
            ...bdStorage
        };

        // @ts-ignore
        globalThis.require = (module: string) => {
            switch (module) {
                case "path": return path;
                default: {
                    new Logger("BdRequire").error(`cannot find polyfill for module ${module}`);
                }
            }
        };
    },
    stop() {
        delete globalThis.BdApi;
    }
});
