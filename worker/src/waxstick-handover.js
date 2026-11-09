import {consumeWarehouseStatements} from './warehouse.js';
const SKU='25018';
async function ensureStore(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS waxstick_handovers(reference TEXT PRIMARY KEY REFERENCES records(reference),ordered_quantity INTEGER NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),actor TEXT NOT NULL,handed_over_at TEXT NOT NULL)`).run();
}
export async function waxstickStatus(db,reference,ErrorType){
  await ensureStore(db);
  const row=await db.prepare('SELECT payload FROM records WHERE reference=?').bind(reference).first();
  if(!row)throw new ErrorType('Opdracht niet gevonden.',404);
  const record=JSON.parse(row.payload),ordered=Number(record.waxstickCount)||0;
  if(record.service!=='Onderhoud'||!Number.isInteger(ordered)||ordered<0||ordered>20)throw new ErrorType('Deze opdracht bevat geen geldige waxstickbestelling.',409);
  const handover=await db.prepare('SELECT * FROM waxstick_handovers WHERE reference=?').bind(reference).first();
  // Older releases deducted resale stock through the workshop step. Preserve those bookings.
  const legacy=await db.prepare(`SELECT COALESCE(SUM(u.quantity),0) quantity,MAX(u.created_at) booked_at FROM maintenance_usage u JOIN maintenance_steps s ON s.id=u.step_id JOIN materials m ON m.id=u.material_id WHERE m.reference=? AND u.sku=? AND s.step_code='waxstick' AND u.is_training=0`).bind(reference,SKU).first();
  const legacyBooked=Number(legacy?.quantity)||0,delivered=Number(handover?.ordered_quantity||0);
  return {reference,sku:SKU,ordered,delivered,remaining:Math.max(0,ordered-delivered),legacyBooked,handedOverAt:handover?.handed_over_at||null,actor:handover?.actor||null};
}
export async function handoverWaxsticks(db,reference,actor,ErrorType){
  let status=await waxstickStatus(db,reference,ErrorType);
  if(!status.ordered)throw new ErrorType('Er is geen waxstick meebesteld bij deze opdracht.',409);
  if(!status.remaining)return {...status,alreadyHandedOver:true};
  const prior=await db.prepare('SELECT reference FROM waxstick_handovers WHERE reference=?').bind(reference).first();
  if(prior)throw new ErrorType('De bestelling is na het meegeven gewijzigd. Controleer de voorraadregistratie.',409);
  const quantity=Math.max(0,status.ordered-status.legacyBooked),item=await db.prepare('SELECT * FROM inventory_items WHERE sku=? AND active=1').bind(SKU).first();
  if(quantity&&(!item||Number(item.on_hand)<quantity))throw new ErrorType('Niet genoeg waxsticks op voorraad. Registreer eerst de ontvangst.',409);
  const stamp=new Date().toISOString();
  try{
    // A unique order key and the stock CHECK constraint make this batch atomic, also on retries.
    await db.batch([
      db.prepare('INSERT INTO waxstick_handovers(reference,ordered_quantity,quantity,actor,handed_over_at) VALUES(?,?,?,?,?)').bind(reference,status.ordered,quantity,actor,stamp),
      ...(quantity?await consumeWarehouseStatements(db,SKU,quantity):[]),
      ...(quantity?[
      db.prepare('UPDATE inventory_items SET on_hand=on_hand-?,updated_at=? WHERE sku=?').bind(quantity,stamp,SKU),
      db.prepare(`INSERT INTO inventory_movements(id,sku,movement_type,quantity,unit_cost,reference_type,reference_id,note,actor,created_at) VALUES(?,?,'maintenance',?,?,'reservation_product',?,?,?,?)`).bind(crypto.randomUUID(),SKU,-quantity,Number(item.average_cost_per_base),reference,`${quantity}× waxstick meegegeven bij opdracht ${reference}`,actor,stamp)
      ]:[])
    ]);
  }catch(error){
    status=await waxstickStatus(db,reference,ErrorType);
    if(!status.remaining)return {...status,alreadyHandedOver:true};
    if(/constraint|on_hand/i.test(String(error?.message||error)))throw new ErrorType('Voorraad is gewijzigd. Vernieuw en controleer het aantal waxsticks.',409);
    throw error;
  }
  return {...await waxstickStatus(db,reference,ErrorType),alreadyHandedOver:false};
}
