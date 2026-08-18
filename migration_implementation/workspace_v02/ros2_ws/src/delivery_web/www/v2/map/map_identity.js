/**
 * MapIdentity — unified map identity (client-side mirror of backend schema)
 */
(function (global) {
  'use strict';

  function mapIdentityFromState(full) {
    if (!full) return null;
    const agv = full.agv || {};
    const map = full.map || {};
    const meta = full.meta || {};
    const mm = full.map_manager || {};
    if (mm.current) return Object.assign({ identity_quality: 'name_only' }, mm.current);
    const name = String(
      agv.current_map || map.current_map || meta.map_name || ''
    ).trim();
    const smapFile = String(map.smap_file || meta.map_file || '').trim();
    if (!name && !smapFile) return null;
    return {
      map_id: name || smapFile.replace(/\.smap$/i, ''),
      name: name || smapFile.replace(/\.smap$/i, ''),
      version: '',
      hash: '',
      source: 'agv',
      identity_quality: agv.current_map ? 'name_only' : 'name_only',
      smap_file: smapFile,
    };
  }

  function identityKey(id) {
    if (!id) return '';
    if (id.version) return `${id.map_id}@${id.version}`;
    if (id.hash) return `${id.map_id}#${String(id.hash).slice(0, 12)}`;
    return id.map_id || id.name || '';
  }

  function sameIdentity(a, b) {
    if (!a || !b) return false;
    if (a.hash && b.hash) return a.hash === b.hash;
    if (a.map_id && b.map_id && a.version && b.version) {
      return a.map_id === b.map_id && a.version === b.version;
    }
    return (a.map_id || a.name) === (b.map_id || b.name);
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.MapIdentity = {
    fromState: mapIdentityFromState,
    key: identityKey,
    same: sameIdentity,
  };
})(window);
