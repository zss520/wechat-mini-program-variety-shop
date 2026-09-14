import { db } from "../db";
import { getSettings, saveSettings } from "../settings";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const before = await getSettings();
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
  } finally {
    await saveSettings(before);
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
