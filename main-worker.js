let sharedArray = null;
let wasmTable = null;

self.onmessage = async function(e) {
    const sharedBuffer = e.data.sharedBuffer;
    sharedArray = new Int32Array(sharedBuffer);
    wasmTable = e.data.wasmTable;

    console.log("[Main Worker] 起動完了。");

    // OPFSの同期アクセスハンドルを初期化
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle("virtual_disk.img", { create: true });
    const accessHandle = await fileHandle.createSyncAccessHandle();
    console.log("[Main Worker] OPFS 高速同期ハンドル取得成功。");

    // テスト用の仮想JITループ実行
    runEmulatorLoop(accessHandle, sharedBuffer);
};

function runEmulatorLoop(accessHandle, sharedBuffer) {
    console.log("[Main Worker] 仮想x86_64 CPU命令の解析を開始...");

    // 1. OPFSの同期読み込みテスト（RAMを逼迫させずにSSDから直接データを吸い上げる）
    const dummyData = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]);
    accessHandle.write(dummyData, { at: 0 }); // ダミー書き込み
    
    const readBuffer = new Uint8Array(4);
    accessHandle.read(readBuffer, { at: 0 }); // 同期読み込み（awaitなし！）
    console.log(`[Main Worker] OPFSからの同期ロードデータ: [${readBuffer.join(", ")}]`);

    // 2. JITコンパイルリクエスト ＆ 物理停止テスト
    const targetPc = 0x401000;
    console.log(`[Main Worker] 🛑 アドレス ${targetPc} で未知の命令に遭遇。JIT要求を出し、自身を物理停止します。`);

    sharedArray[1] = targetPc; // 要求アドレス
    sharedArray[0] = 1;        // ステータスを「1: 要求中」へ

    // 🔥 ここでスレッドを完全ロック
    Atomics.wait(sharedArray, 0, 1);

    // ─── コンパイルWorkerに叩き起こされる ───
    const tableIndex = sharedArray[2];
    console.log(`[Main Worker] 🎉 覚醒！ コンパイル完了を検知。Table Index: ${tableIndex} からWasmを実行します。`);

    const generatedFunc = wasmTable.get(tableIndex);
    generatedFunc(); // 今作られたばかりの動的Wasm関数を実行！
}
