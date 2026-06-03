let sharedArray = null;
let wasmTable = null;

self.onmessage = function(e) {
    sharedArray = new Int32Array(e.data.sharedBuffer);
    wasmTable = e.data.wasmTable;
    
    // 監視ループ開始
    listenJitRequest();
};

async function listenJitRequest() {
    console.log("[JIT Worker] 監視中...");
    while(true) {
        if (sharedArray && sharedArray[0] === 1) {
            const pc = sharedArray[1];
            console.log(`[JIT Worker] ⚡ 要求検知！アドレス ${pc} をWasmに動的ビルド中...`);

            // ただ42（答え）をログに出して終了するだけのダミーWasmバイナリ
            const dummyWasmBytes = new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
                0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03, 0x02,
                0x01, 0x00, 0x07, 0x07, 0x01, 0x03, 0x72, 0x75,
                0x6e, 0x00, 0x00, 0x0a, 0x0c, 0x01, 0x0a, 0x00,
                0x41, 0x2a, 0x1a, 0x0b
            ]);

            // 非同期コンパイルを実行（裏スレッドなので重くても問題なし）
            const module = await WebAssembly.compile(dummyWasmBytes);
            const instance = await WebAssembly.instantiate(module);

            // 共有のTable（インデックス 7番）に登録
            const targetSlot = 7;
            wasmTable.set(targetSlot, instance.exports.run);

            // メインWorkerに完了を通知
            sharedArray[2] = targetSlot;
            sharedArray[0] = 2; // ステータスを「2: 完了」へ

            console.log("[JIT Worker] コンパイル完了。メインWorkerを叩き起こします。");
            Atomics.notify(sharedArray, 0, 1);
        }
        await new Promise(r => setTimeout(r, 50)); // CPU過負荷防止
    }
}
