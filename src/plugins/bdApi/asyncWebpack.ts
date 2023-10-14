function makeWebpackSearchWorker() {
    // Step 1: Build Export and Code map to pass to the worker.
    // This is because you can't serialise functions, so we have to transform webpack first

    var exportMap = {};
    var codeMap = {};

    function addExports(id, exports, path = "") {
        if (!exports || exports === window || typeof exports !== "object" || Array.isArray(exports)) return;
        const names = ((exportMap[id] ??= {})[path] ??= []);
        for (const key in exports) try {
            if (!path && (key === "default" || key.length <= 3)) {
                const m = exports[key];
                if (typeof m === "function") {
                    addFunction(id, key, m, path);
                } else addExports(id, m, key);
            } else {
                if (typeof exports[key] === "function")
                    addFunction(id, key, exports[key], path);
                names.push(key);
            }
        } catch { }
    }

    function addFunction(id, key, func, path) {
        ((codeMap[id] ??= {})[path] ??= []).push([key, func.toString()]);
    }

    for (const id in Vencord.Webpack.cache) {
        const m = Vencord.Webpack.cache[id]?.exports;
        if (!m || m === window) continue;

        if (typeof m === "function") addFunction(id, "", m, "");
        else addExports(id, m);
    }

    // Step 2: The worker code

    function workerCode() {
        let exportMap, codeMap;
        self.onmessage = ({ data }) => {
            const [op, id, ...rest] = data;
            switch (op) {
                case "setMaps":
                    exportMap = data[1];
                    codeMap = data[2];
                    break;
                case "findByProps": {
                    const props = rest[0];
                    let found = null;
                    outer:
                    for (const id in exportMap) {
                        for (const path in exportMap[id]) {
                            const exports = exportMap[id][path];
                            if (props.every(p => exports.includes(p))) {
                                // @ts-ignore
                                found = [id, path];
                                break outer;
                            }
                        }
                    }
                    self.postMessage([op, id, found]);
                    break;
                }
                case "findByCode": {
                    const code = rest[0];
                    let found = null;
                    outer:
                    for (const id in codeMap) {
                        for (const path in codeMap[id]) {
                            const codes = codeMap[id][path];
                            for (const [key, func] of codes) {
                                if (func.includes(code)) {
                                    // @ts-ignore
                                    found = [id, path, key];
                                    break outer;
                                }
                            }
                        }
                    }
                    self.postMessage([op, id, found]);
                    break;
                }
            }
        };
    }

    // Step 3: Create worker with the code and set its maps

    const worker = new Worker(`data:text/javascript,!${workerCode.toString()}()`);
    worker.postMessage(["setMaps", exportMap, codeMap]);

    // Step 4: Main thread logic

    const resolvers = {};
    let id = 0;

    worker.onmessage = ({ data }) => {
        const [op, resolverId, d] = data;
        const [id, path, key] = d ?? [];

        if (!id) return void resolvers[resolverId](null);
        let m = Vencord.Webpack.wreq(id);
        if (path) m = m[path];

        resolvers[resolverId](op === "findByCode" && key ? m[key] : m);
        delete resolvers[resolverId];
    };

    // Step 5: Wrapper functions

    return {
        byProps: (...props) => new Promise(r => {
            const mId = id++;
            resolvers[mId] = r;
            worker.postMessage(["findByProps", mId, props]);
        }),

        byCode: code => new Promise(r => {
            const mId = id++;
            resolvers[mId] = r;
            worker.postMessage(["findByCode", mId, code]);
        })
    };
}