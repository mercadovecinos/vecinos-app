// VECINOS Apps Script — repartidor + misiones + vendors
// No editar manualmente. La ruta se genera desde el admin al subir el CSV.

var SHEET_ID = "1FfHlmN8bAcoN_-sqoYKNni5GvDxAkiPVDoq-aOEWye4";

function doGet(e) {
  var action   = (e.parameter && e.parameter.action)   || "paradas";
  var ruta_id  = (e.parameter && e.parameter.ruta_id)  || "";
  var callback = (e.parameter && e.parameter.callback) || "";

  if (action === "paradas") {
    var config = getLatestConfig();
    if (config) return ok({ ok:true, paradas:config.paradas, fecha:config.fecha, ruta_id:config.ruta_id }, callback);
    return ok({ ok:true, paradas:[], fecha:'', ruta_id:'' }, callback);
  }
  if (action === "misiones") {
    var activeId = getActiveRutaId();
    return ok({ ok:true, misiones:getMisiones(activeId), misionesDone:getMisionDone(activeId) }, callback);
  }
  if (action === "vendors")         return ok({ ok:true, vendors:getVendors(ruta_id || getActiveRutaId()) }, callback);
  if (action === "km")              return ok({ ok:true, km:getKm(getActiveRutaId()) }, callback);
  if (action === "prodOverrides")   return ok({ ok:true, overrides:getProdOverrides(getActiveRutaId()) }, callback);
  if (action === "productMeta")     return ok(getProductMeta(), callback);
  if (action === "vendorMeta")      return ok(getVendorMeta(), callback);
  if (action === "pickerProgress")  return ok(getPickerProgress(getActiveRutaId()), callback);
  if (action === "stops")           return ok({ ok:true, stops:getStops(getActiveRutaId()) }, callback);
  return ok({ ok:false, error:"unknown action: " + action }, callback);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === "update")             { saveStop(data);             return ok({ok:true}); }
    if (data.action === "saveMisiones")       { saveMisiones(data);         return ok({ok:true}); }
    if (data.action === "saveVendors")        { saveVendors(data);          return ok({ok:true}); }
    if (data.action === "newRuta")            { saveNewRuta(data);          return ok({ok:true}); }
    if (data.action === "saveKm")             { saveKm(data);               return ok({ok:true}); }
    if (data.action === "saveMisionDone")     { saveMisionDone(data);       return ok({ok:true}); }
    if (data.action === "saveProdOverrides")  { saveProdOverrides(data);    return ok({ok:true}); }
    if (data.action === "saveProductMeta")    { saveProductMeta(data);      return ok({ok:true}); }
    if (data.action === "saveVendorMeta")     { saveVendorMeta(data);       return ok({ok:true}); }
    if (data.action === "savePickerProgress") { savePickerProgress(data);   return ok({ok:true}); }
    if (data.action === "resetRuta")          { resetRuta(data);            return ok({ok:true}); }
    return ok({ok:false, error:"unknown action: " + data.action});
  } catch(err) {
    return ok({ok:false, error:err.message});
  }
}

function ok(obj, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(obj) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName("Progreso");
  if (!s) { s = ss.insertSheet("Progreso"); s.appendRow(["fecha","ruta_id","parada_id","nombre","tipo","timestamp","estado"]); s.setFrozenRows(1); }
  return s;
}
function getMisionSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName("Misiones");
  if (!s) { s = ss.insertSheet("Misiones"); s.appendRow(["ruta_id","misiones_json","updated"]); s.setFrozenRows(1); }
  return s;
}
function getVendorSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName("Vendors");
  if (!s) { s = ss.insertSheet("Vendors"); s.appendRow(["ruta_id","vendors_json","updated"]); s.setFrozenRows(1); }
  return s;
}

function saveStop(data) {
  var s=getSheet(), vals=s.getDataRange().getValues(), found=-1;
  for(var i=1;i<vals.length;i++){ if(String(vals[i][1])===data.ruta_id&&String(vals[i][2])===String(data.parada_id)){found=i+1;break;} }
  var row=[data.fecha||"",data.ruta_id,String(data.parada_id),data.nombre,data.tipo,Utilities.formatDate(new Date(),"America/Santiago","dd/MM HH:mm"),data.estado];
  if(found>0) s.getRange(found,1,1,7).setValues([row]); else s.appendRow(row);
}
function getStops(ruta_id) {
  var s=getSheet(),vals=s.getDataRange().getValues(),r={};
  for(var i=1;i<vals.length;i++){ if(!ruta_id||String(vals[i][1])===ruta_id) r[String(vals[i][2])]={nombre:vals[i][3],tipo:vals[i][4],timestamp:vals[i][5],estado:vals[i][6]}; }
  return r;
}
function saveMisiones(data) {
  var s=getMisionSheet(),vals=s.getDataRange().getValues(),found=-1;
  for(var i=1;i<vals.length;i++){ if(String(vals[i][0])===data.ruta_id){found=i+1;break;} }
  var row=[data.ruta_id,JSON.stringify(data.misiones),Utilities.formatDate(new Date(),"America/Santiago","dd/MM HH:mm")];
  if(found>0) s.getRange(found,1,1,3).setValues([row]); else s.appendRow(row);
}
function getMisiones(ruta_id) {
  var s=getMisionSheet(),vals=s.getDataRange().getValues();
  for(var i=1;i<vals.length;i++){ if(String(vals[i][0])===ruta_id){ try{return JSON.parse(vals[i][1]);}catch(e){return [];} } }
  return [];
}
function saveVendors(data) {
  var s=getVendorSheet(),vals=s.getDataRange().getValues(),found=-1;
  for(var i=1;i<vals.length;i++){ if(String(vals[i][0])===data.ruta_id){found=i+1;break;} }
  var row=[data.ruta_id,JSON.stringify(data.vendors),Utilities.formatDate(new Date(),"America/Santiago","dd/MM HH:mm")];
  if(found>0) s.getRange(found,1,1,3).setValues([row]); else s.appendRow(row);
}
function getVendors(ruta_id) {
  var s=getVendorSheet(),vals=s.getDataRange().getValues();
  for(var i=1;i<vals.length;i++){ if(String(vals[i][0])===ruta_id){ try{return JSON.parse(vals[i][1]);}catch(e){return {};} } }
  return {};
}

function getConfigSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName("Config");
  if (!s) {
    s = ss.insertSheet("Config");
    s.appendRow(["ruta_id","fecha","paradas_json","updated"]);
    s.setFrozenRows(1);
  }
  return s;
}

function saveNewRuta(data) {
  // Save paradas config
  var s    = getConfigSheet();
  var vals = s.getDataRange().getValues();
  var found = -1;
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === data.ruta_id) { found = i+1; break; }
  }
  var ts  = Utilities.formatDate(new Date(), "America/Santiago", "dd/MM HH:mm");
  var row = [data.ruta_id, data.fecha, JSON.stringify(data.paradas), ts];
  if (found > 0) s.getRange(found,1,1,4).setValues([row]);
  else s.appendRow(row);

  // Also save vendors
  saveVendors({ ruta_id:data.ruta_id, vendors:data.vendors });
  // Note: misiones are NOT cleared here — admin clears them explicitly on CSV upload only
}

function getLatestConfig() {
  var s    = getConfigSheet();
  var vals = s.getDataRange().getValues();
  if (vals.length < 2) return null;
  // Return last row (most recent upload)
  var last = vals[vals.length - 1];
  try {
    return { ruta_id:String(last[0]), fecha:String(last[1]), paradas:JSON.parse(last[2]) };
  } catch(e) { return null; }
}

function getActiveRutaId() {
  var config = getLatestConfig();
  return config ? config.ruta_id : '';
}

function getKmSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName("Km");
  if (!s) { s = ss.insertSheet("Km"); s.appendRow(["ruta_id","km_inicio","km_fin","updated"]); s.setFrozenRows(1); }
  return s;
}

function getMisionDoneSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName("MisionDone");
  if (!s) { s = ss.insertSheet("MisionDone"); s.appendRow(["ruta_id","done_json","updated"]); s.setFrozenRows(1); }
  return s;
}

function saveKm(data) {
  var s    = getKmSheet();
  var vals = s.getDataRange().getValues();
  var ts   = Utilities.formatDate(new Date(), "America/Santiago", "dd/MM HH:mm");
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === data.ruta_id) {
      var ki = data.kmInicio || String(vals[i][1]);
      var kf = data.kmFin    || String(vals[i][2]);
      s.getRange(i+1,1,1,4).setValues([[data.ruta_id, ki, kf, ts]]);
      return;
    }
  }
  s.appendRow([data.ruta_id, data.kmInicio||'', data.kmFin||'', ts]);
}

function getKm(ruta_id) {
  var s    = getKmSheet();
  var vals = s.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === ruta_id) return { kmInicio: String(vals[i][1]), kmFin: String(vals[i][2]) };
  }
  return { kmInicio:'', kmFin:'' };
}

function saveMisionDone(data) {
  var s    = getMisionDoneSheet();
  var vals = s.getDataRange().getValues();
  var ts   = Utilities.formatDate(new Date(), "America/Santiago", "dd/MM HH:mm");
  var json = JSON.stringify(data.misionesDone || {});
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === data.ruta_id) { s.getRange(i+1,1,1,3).setValues([[data.ruta_id,json,ts]]); return; }
  }
  s.appendRow([data.ruta_id, json, ts]);
}

function getMisionDone(ruta_id) {
  var s    = getMisionDoneSheet();
  var vals = s.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === ruta_id) {
      try { return JSON.parse(String(vals[i][1])); } catch(e) { return {}; }
    }
  }
  return {};
}


function resetRuta(data) {
  function clearSheet(s) {
    try {
      var n = s.getLastRow();
      if (n > 1) s.deleteRows(2, n - 1);
    } catch(e) {}
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ['Progreso','Misiones','MisionDone','Km','Config','Vendors','ProdOverrides','ProductMeta','VendorMeta','PickerProgress'];
  sheets.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh) clearSheet(sh);
  });
}


// ── PROD OVERRIDES ───────────────────────────────────────────────────
function getProdOverridesSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName('ProdOverrides');
  if (!s) {
    s = ss.insertSheet('ProdOverrides');
    s.appendRow(['ruta_id', 'overrides_json', 'updated']);
    s.setFrozenRows(1);
  }
  return s;
}

function getProdOverrides(ruta_id) {
  var sh   = getProdOverridesSheet();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === ruta_id) {
      try { return JSON.parse(data[i][1]); } catch(e) { return {}; }
    }
  }
  return {};
}

function saveProdOverrides(data) {
  var sh      = getProdOverridesSheet();
  var ruta_id = data.ruta_id;
  var json    = JSON.stringify(data.overrides || {});
  var rows    = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === ruta_id) {
      sh.getRange(i+1, 2, 1, 2).setValues([[json, new Date()]]);
      return;
    }
  }
  sh.appendRow([ruta_id, json, new Date()]);
}

function autorizar() {
  getSheet(); getMisionSheet(); getVendorSheet(); getConfigSheet();
  getKmSheet(); getMisionDoneSheet(); getProdOverridesSheet();
  getProductMetaSheet(); getVendorMetaSheet(); getPickerSheet();
  Logger.log('Todas las sheets creadas correctamente');
}

// ── PRODUCT META (C/R/nota por producto, global) ─────────────────────────────
function getProductMetaSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName('ProductMeta');
  if (!s) {
    s = ss.insertSheet('ProductMeta');
    s.appendRow(['product_key','congelado','refrigerado','nota','updated']);
    s.setFrozenRows(1);
  }
  return s;
}

function saveProductMeta(data) {
  // data.meta = { "Queso Mantecoso||Borlone": {c:true, r:false, nota:"..."}, ... }
  var sh  = getProductMetaSheet();
  var now = new Date().toISOString();
  Object.keys(data.meta).forEach(function(key) {
    var m    = data.meta[key];
    var rows = sh.getDataRange().getValues(); // reload each time to prevent duplicates
    var found = false;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        sh.getRange(i+1, 2, 1, 4).setValues([[m.c||false, m.r||false, m.nota||'', now]]);
        found = true; break;
      }
    }
    if (!found) sh.appendRow([key, m.c||false, m.r||false, m.nota||'', now]);
  });
  return {ok:true};
}

function getProductMeta() {
  var sh = getProductMetaSheet();
  var rows = sh.getDataRange().getValues();
  var meta = {};
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    meta[rows[i][0]] = { c: rows[i][1], r: rows[i][2], nota: rows[i][3] };
  }
  return {ok:true, meta:meta};
}

// ── VENDOR META (estado recepción por proveedor, global) ─────────────────────
function getVendorMetaSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName('VendorMeta');
  if (!s) {
    s = ss.insertSheet('VendorMeta');
    s.appendRow(['vendor','estado','updated']);
    s.setFrozenRows(1);
  }
  return s;
}

function saveVendorMeta(data) {
  // Clear-and-rewrite atómico: evita bugs de upsert con nombres duplicados/similares
  var sh  = getVendorMetaSheet();
  var n = sh.getLastRow();
  if (n > 1) sh.deleteRows(2, n - 1);
  var now = new Date().toISOString();
  var rows = Object.keys(data.meta).map(function(vendor) {
    return [vendor, data.meta[vendor], now];
  });
  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, 3).setValues(rows);
    SpreadsheetApp.flush();
  }
  return {ok:true};
}

function getVendorMeta() {
  var sh = getVendorMetaSheet();
  var rows = sh.getDataRange().getValues();
  var meta = {};
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    meta[rows[i][0]] = rows[i][1];
  }
  return {ok:true, meta:meta};
}

// ── PICKER PROGRESS (productos chequeados por pedido) ────────────────────────
function getPickerSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName('PickerProgress');
  if (!s) {
    s = ss.insertSheet('PickerProgress');
    s.appendRow(['ruta_id','progress_json','updated']);
    s.setFrozenRows(1);
  }
  return s;
}

function savePickerProgress(data) {
  // data.ruta_id, data.progress = { "#1234": [0,2], "#1235": [0,1,2] }
  var sh = getPickerSheet();
  var rows = sh.getDataRange().getValues();
  var now = new Date().toISOString();
  var json = JSON.stringify(data.progress);
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.ruta_id) {
      sh.getRange(i+1, 2, 1, 2).setValues([[json, now]]);
      return {ok:true};
    }
  }
  sh.appendRow([data.ruta_id, json, now]);
  return {ok:true};
}

function getPickerProgress(ruta_id) {
  var sh = getPickerSheet();
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === ruta_id) {
      try { return {ok:true, progress: JSON.parse(rows[i][1])}; }
      catch(e) { return {ok:true, progress:{}}; }
    }
  }
  return {ok:true, progress:{}};
}
