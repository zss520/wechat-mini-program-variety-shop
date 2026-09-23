import { db } from "../db";
import { fallbackMiniprogramState, fallbackSubscribeTemplateId } from "../subscribeMessage";
import { getSettings, saveSettings } from "../settings";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function restoreSettingRow(skey: string, row?: { svalue?: string }) {
  if (!row) {
    await db("shop_settings").where({ skey }).delete();
    return;
  }
  const exists = await db("shop_settings").where({ skey }).first();
  if (exists) await db("shop_settings").where({ skey }).update({ svalue: row.svalue ?? "" });
  else await db("shop_settings").insert({ skey, svalue: row.svalue ?? "" });
}

async function run() {
  const before = await getSettings();
  const tmplBefore = await db("shop_settings").where({ skey: "wx_subscribe_pack_tmpl" }).first();
  const stateBefore = await db("shop_settings").where({ skey: "wx_miniprogram_state" }).first();
  const stamp = `铺_${Date.now()}`;
  try {
    const merged = await saveSettings({ shop_name: stamp });
    assert(merged.shop_name === stamp, "partial save updates shop_name");
    assert(merged.intro === before.intro, "partial save keeps intro");
    assert(merged.phone === before.phone, "partial save keeps phone");
    assert(merged.pickup_address === before.pickup_address, "partial save keeps pickup_address");
    assert(merged.freight_cent === before.freight_cent, "partial save keeps freight");
    assert(merged.logo_url === before.logo_url, "partial save keeps logo_url");

    await db("shop_settings").where({ skey: "freight_cent" }).update({ svalue: "0" });
    const zeroFreight = await getSettings();
    assert(zeroFreight.freight_cent === 0, "numeric 0 is kept, not treated as missing");

    await db("shop_settings").where({ skey: "pause_order" }).update({ svalue: "false" });
    const pausedOff = await getSettings();
    assert(pausedOff.pause_order === false, "boolean false parses");

    const again = await saveSettings({ pause_order: true, logo_url: "/static/placeholders/p1.png" });
    assert(again.pause_order === true, "pause_order saved true");
    assert(again.logo_url === "/static/placeholders/p1.png", "logo_url saved");
    assert(again.shop_name === stamp, "later patch keeps previous shop_name");

    const limited = await saveSettings({ amap_monthly_limit: 88 });
    assert(limited.amap_monthly_limit === 88, "amap monthly limit saved");
    const keptLimit = await saveSettings({ shop_name: `${stamp}_b` });
    assert(keptLimit.shop_name === `${stamp}_b`, "name patch updates shop_name");
    assert(keptLimit.amap_monthly_limit === 88, "partial save keeps amap monthly limit");
    let rejected = false;
    try {
      await saveSettings({ amap_monthly_limit: 10000001 });
    } catch {
      rejected = true;
    }
    assert(rejected, "amap limit above 10000000 is rejected");
    const still = await getSettings();
    assert(still.amap_monthly_limit === 88, "rejected limit does not overwrite");

    const customId = "Abcdefghij_KL-25930template";
    const custom = await saveSettings({ wx_subscribe_pack_tmpl: `  ${customId}  `, wx_miniprogram_state: "trial" });
    assert(custom.wx_subscribe_pack_tmpl === customId, "template id trimmed and saved");
    assert(custom.wx_miniprogram_state === "trial", "miniprogram state saved");
    const keptSubscribe = await saveSettings({ shop_name: `${stamp}_c` });
    assert(keptSubscribe.wx_subscribe_pack_tmpl === customId, "partial save keeps template id");
    assert(keptSubscribe.wx_miniprogram_state === "trial", "partial save keeps miniprogram state");
    let badTmpl = false;
    try {
      await saveSettings({ wx_subscribe_pack_tmpl: "短" });
    } catch {
      badTmpl = true;
    }
    assert(badTmpl, "short template id is rejected");
    let badState = false;
    try {
      await saveSettings({ wx_miniprogram_state: "release" as "developer" });
    } catch {
      badState = true;
    }
    assert(badState, "unknown miniprogram state is rejected");
    const unchanged = await getSettings();
    assert(unchanged.wx_subscribe_pack_tmpl === customId, "rejected subscribe config does not overwrite template");
    assert(unchanged.wx_miniprogram_state === "trial", "rejected subscribe config does not overwrite state");
    await db("shop_settings").where({ skey: "wx_subscribe_pack_tmpl" }).delete();
    await db("shop_settings").where({ skey: "wx_miniprogram_state" }).delete();
    const fallback = await getSettings();
    assert(fallback.wx_subscribe_pack_tmpl === fallbackSubscribeTemplateId(), "missing template uses env or default");
    assert(fallback.wx_miniprogram_state === fallbackMiniprogramState(), "missing state uses env or default");
  } finally {
    const restore = { ...before } as Record<string, unknown>;
    delete restore.wx_subscribe_pack_tmpl;
    delete restore.wx_miniprogram_state;
    await saveSettings(restore);
    await restoreSettingRow("wx_subscribe_pack_tmpl", tmplBefore);
    await restoreSettingRow("wx_miniprogram_state", stateBefore);
  }
  await db.destroy();
  console.log("shop settings tests passed");
}

run().catch(async (e) => {
  console.error(e);
  try {
    await db.destroy();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
