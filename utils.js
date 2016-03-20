// http://stackoverflow.com/a/21273362/1449056
function undefinedOrNull(variable) {	 return variable === undefined || variable === null; } //return variable == null;

// checks to see if an object has any properties
// Returns true for empty objects and false for non-empty objects
function isEmpty(obj) {
	// Object.getOwnPropertyNames(obj).length vs. Object.keys(obj).length
	// http://stackoverflow.com/a/22658584/1449056
	return (undefinedOrNull(obj) || Object.getOwnPropertyNames(obj).length === 0);
}

function isString(obj) {
    return (typeof obj === 'string' || obj instanceof String);
}

function getISOTimestamp() {
    return (new Date()).toISOString() + Math.random();
}

function logException(timestamp, data, message) {
    //TEMPORARY solution until log functions' output is available from GameManager
    return server.SetTitleData({
        Key: timestamp,
        Value: JSON.stringify({Message: message, Data: data})
    });
}

function createSharedGroup(id) {
		try { server.CreateSharedGroup({SharedGroupId : id});
    } catch (e) { /*logException(getISOTimestamp(), e, 'createSharedGroup:' + id);*/throw e; }
}

function updateSharedGroupData(id, data) {
    var key, stringData = {};
    try {
        for (key in data) {
            if (data.hasOwnProperty(key)) {
							if (!undefinedOrNull(data[key])) {
	                stringData[key] = JSON.stringify(data[key]);
	            } else {
								stringData[key] = data[key];
							}
						}
        }
        key = server.UpdateSharedGroupData({ SharedGroupId: id, Data: stringData });
        return key;
    } catch (e) { logException(getISOTimestamp(), {ret: key, err: e}, 'updateSharedGroupData(' + id + ', ' + JSON.stringify(stringData) + ')'); throw e; }
}

function getSharedGroupData(id, keys) {
		var data = {}, key;
    try {
        if (undefinedOrNull(keys)) {
            data = server.GetSharedGroupData({ SharedGroupId: id }).Data;
        } else {
            data = server.GetSharedGroupData({ SharedGroupId: id, Keys: keys }).Data;
        }
        for (key in data) {
            if (data.hasOwnProperty(key)) {
                data[key] = JSON.parse(data[key].Value); // 'LastUpdated' and 'Permission' properties are overwritten
            }
        }
        return data;
    } catch (e) { logException(getISOTimestamp(), {ret: data, err: e}, 'getSharedGroupData:' + id + ',' + JSON.stringify(keys)); throw e; }
}

function deleteSharedGroup(id) {
	var result;
    try {
			result = server.DeleteSharedGroup({SharedGroupId : id});
			return result;
		} catch (e) {
			logException(getISOTimestamp(), {err: e, ret: result}, 'deleteSharedGroup:' + id); throw e;
		}
}

function getSharedGroupEntry(id, key) {
	var result;
    try {
			result = getSharedGroupData(id, [key])[key];
			return result;
		} catch (e) { logException(getISOTimestamp(), {err: e, ret: result},'getSharedGroupEntry:' + id + ',' + key); throw e; }
}

function updateSharedGroupEntry(id, key, value) {
    try {
        var data = {};
        data[key] = value;
        return updateSharedGroupData(id, data);
    } catch (e) { logException(getISOTimestamp(), e, 'updateSharedGroupEntry:' + id + ',' + key + ',' + value); throw e; }
}

function deleteSharedGroupEntry(id, key) {
    try { return updateSharedGroupEntry(id, key, null); } catch (e) { logException(getISOTimestamp(), e, 'deleteSharedGroupEntry:' + id + ',' + key); throw e; }
}
